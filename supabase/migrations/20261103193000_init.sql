-- ShelfLife initial schema: tables + RLS, helpers, mutation RPCs.
-- Every stock write goes through a security definer RPC that checks the
-- caller's shop/role, applies the change and logs one stock_events row in the
-- same transaction. Clients only ever SELECT from tables.

-- ─── Tables (RLS enabled alongside each) ─────────────────────────────────────

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  expiry_window_days int not null default 7 check (expiry_window_days between 1 and 60),
  created_at timestamptz not null default now()
);
alter table public.shops enable row level security;

create table public.memberships (            -- one shop per user
  user_id uuid primary key references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  role text not null check (role in ('manager', 'staff')),
  display_name text not null,
  created_at timestamptz not null default now()
);
alter table public.memberships enable row level security;
create index memberships_shop_id_idx on public.memberships (shop_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  barcode text not null check (barcode ~ '^\d{8,14}$'),
  name text not null check (length(btrim(name)) between 1 and 120),
  brand text,
  image_url text,
  quantity int not null default 0 check (quantity >= 0),
  min_quantity int not null default 0 check (min_quantity >= 0),
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, barcode)
);
alter table public.products enable row level security;
create index products_shop_expiry_idx on public.products (shop_id, expiry_date);

create table public.stock_events (          -- append-only audit log
  id bigserial primary key,
  shop_id uuid not null references public.shops (id) on delete cascade,
  -- set null so a 'delete' event (and earlier history) survives the product
  product_id uuid references public.products (id) on delete set null,
  product_name text not null,               -- snapshot, so the feed reads after delete
  user_id uuid references auth.users (id) on delete set null,
  type text not null check (type in ('create', 'restock', 'count', 'edit', 'delete')),
  qty_before int,
  qty_after int,
  expiry_before date,
  expiry_after date,
  created_at timestamptz not null default now()
);
alter table public.stock_events enable row level security;
create index stock_events_shop_created_idx on public.stock_events (shop_id, created_at desc);
create index stock_events_product_idx on public.stock_events (product_id);

-- Clients read only. No insert/update/delete grants, no write policies.
revoke all on table public.shops, public.memberships, public.products, public.stock_events
  from anon, authenticated;
grant select on table public.shops, public.memberships, public.products, public.stock_events
  to authenticated;

-- ─── Helpers (security definer, otherwise the memberships policy recurses) ───

create function public.my_shop_id() returns uuid
language sql stable security definer set search_path = public as $$
  select shop_id from memberships where user_id = auth.uid()
$$;

create function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'manager' from memberships where user_id = auth.uid()), false)
$$;

-- ─── Policies ────────────────────────────────────────────────────────────────

create policy shops_select on public.shops
  for select to authenticated using (id = (select public.my_shop_id()));
create policy memberships_select on public.memberships
  for select to authenticated using (shop_id = (select public.my_shop_id()));
create policy products_select on public.products
  for select to authenticated using (shop_id = (select public.my_shop_id()));
create policy stock_events_select on public.stock_events
  for select to authenticated using (shop_id = (select public.my_shop_id()));

-- ─── RPCs ────────────────────────────────────────────────────────────────────

create function public.create_product(
  p_barcode text, p_name text, p_brand text, p_image_url text,
  p_quantity int, p_expiry_date date, p_min_quantity int
) returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := my_shop_id();
  v_qty int := coalesce(p_quantity, 0);
  v_exp date;
  v_row products;
begin
  if v_shop is null then
    raise exception 'Your account isn''t linked to a shop' using errcode = '42501';
  end if;
  if p_barcode is null or p_barcode !~ '^\d{8,14}$' then
    raise exception 'Barcode must be 8 to 14 digits' using errcode = '22023';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 120 then
    raise exception 'Name is required (max 120 characters)' using errcode = '22023';
  end if;
  if v_qty < 0 then
    raise exception 'Quantity can''t be negative' using errcode = '22023';
  end if;
  if coalesce(p_min_quantity, 0) < 0 then
    raise exception 'Minimum quantity can''t be negative' using errcode = '22023';
  end if;
  v_exp := case when v_qty = 0 then null else p_expiry_date end;

  begin
    insert into products (shop_id, barcode, name, brand, image_url, quantity, min_quantity, expiry_date)
    values (v_shop, p_barcode, btrim(p_name), nullif(btrim(p_brand), ''), nullif(btrim(p_image_url), ''),
            v_qty, coalesce(p_min_quantity, 0), v_exp)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'A product with barcode % already exists in this shop', p_barcode using errcode = '23505';
  end;

  insert into stock_events (shop_id, product_id, product_name, user_id, type,
                            qty_before, qty_after, expiry_before, expiry_after)
  values (v_shop, v_row.id, v_row.name, auth.uid(), 'create', null, v_qty, null, v_exp);
  return v_row;
end $$;

create function public.restock(p_product_id uuid, p_add_qty int, p_expiry_date date)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := my_shop_id();
  v_old products;
  v_row products;
  v_exp date;
begin
  if v_shop is null then
    raise exception 'Your account isn''t linked to a shop' using errcode = '42501';
  end if;
  if p_add_qty is null or p_add_qty <= 0 then
    raise exception 'Restock quantity must be at least 1' using errcode = '22023';
  end if;
  select * into v_old from products where id = p_product_id and shop_id = v_shop for update;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  -- Earliest date wins; empty shelf or unknown date takes the incoming date.
  -- least() ignores nulls, so a restock without a date keeps the current one.
  v_exp := case
    when v_old.quantity = 0 or v_old.expiry_date is null then coalesce(p_expiry_date, v_old.expiry_date)
    else least(v_old.expiry_date, p_expiry_date)
  end;

  update products set quantity = quantity + p_add_qty, expiry_date = v_exp, updated_at = now()
  where id = v_old.id returning * into v_row;

  insert into stock_events (shop_id, product_id, product_name, user_id, type,
                            qty_before, qty_after, expiry_before, expiry_after)
  values (v_shop, v_row.id, v_row.name, auth.uid(), 'restock',
          v_old.quantity, v_row.quantity, v_old.expiry_date, v_row.expiry_date);
  return v_row;
end $$;

create function public.set_count(p_product_id uuid, p_qty int, p_earliest_expiry date)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := my_shop_id();
  v_old products;
  v_row products;
begin
  if v_shop is null then
    raise exception 'Your account isn''t linked to a shop' using errcode = '42501';
  end if;
  if p_qty is null or p_qty < 0 then
    raise exception 'Count can''t be negative' using errcode = '22023';
  end if;
  select * into v_old from products where id = p_product_id and shop_id = v_shop for update;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  update products
  set quantity = p_qty,
      expiry_date = case when p_qty = 0 then null else p_earliest_expiry end,
      updated_at = now()
  where id = v_old.id returning * into v_row;

  insert into stock_events (shop_id, product_id, product_name, user_id, type,
                            qty_before, qty_after, expiry_before, expiry_after)
  values (v_shop, v_row.id, v_row.name, auth.uid(), 'count',
          v_old.quantity, v_row.quantity, v_old.expiry_date, v_row.expiry_date);
  return v_row;
end $$;

create function public.update_product(p_product_id uuid, p_name text, p_brand text, p_min_quantity int)
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := my_shop_id();
  v_row products;
begin
  if v_shop is null then
    raise exception 'Your account isn''t linked to a shop' using errcode = '42501';
  end if;
  if not is_manager() then
    raise exception 'Only managers can edit products' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 120 then
    raise exception 'Name is required (max 120 characters)' using errcode = '22023';
  end if;
  if p_min_quantity is null or p_min_quantity < 0 then
    raise exception 'Minimum quantity can''t be negative' using errcode = '22023';
  end if;

  update products
  set name = btrim(p_name), brand = nullif(btrim(p_brand), ''), min_quantity = p_min_quantity,
      updated_at = now()
  where id = p_product_id and shop_id = v_shop
  returning * into v_row;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  insert into stock_events (shop_id, product_id, product_name, user_id, type,
                            qty_before, qty_after, expiry_before, expiry_after)
  values (v_shop, v_row.id, v_row.name, auth.uid(), 'edit',
          v_row.quantity, v_row.quantity, v_row.expiry_date, v_row.expiry_date);
  return v_row;
end $$;

create function public.delete_product(p_product_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := my_shop_id();
  v_old products;
begin
  if v_shop is null then
    raise exception 'Your account isn''t linked to a shop' using errcode = '42501';
  end if;
  if not is_manager() then
    raise exception 'Only managers can delete products' using errcode = '42501';
  end if;
  select * into v_old from products where id = p_product_id and shop_id = v_shop for update;
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;

  insert into stock_events (shop_id, product_id, product_name, user_id, type,
                            qty_before, qty_after, expiry_before, expiry_after)
  values (v_shop, v_old.id, v_old.name, auth.uid(), 'delete',
          v_old.quantity, null, v_old.expiry_date, null);
  delete from products where id = v_old.id;   -- history keeps product_name, product_id → null
end $$;

create function public.update_shop(p_name text, p_expiry_window_days int)
returns public.shops
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid := my_shop_id();
  v_row shops;
begin
  if v_shop is null then
    raise exception 'Your account isn''t linked to a shop' using errcode = '42501';
  end if;
  if not is_manager() then
    raise exception 'Only managers can change shop settings' using errcode = '42501';
  end if;
  if nullif(btrim(p_name), '') is null or length(btrim(p_name)) > 80 then
    raise exception 'Shop name is required (max 80 characters)' using errcode = '22023';
  end if;
  if p_expiry_window_days is null or p_expiry_window_days not between 1 and 60 then
    raise exception 'Expiry window must be between 1 and 60 days' using errcode = '22023';
  end if;

  update shops set name = btrim(p_name), expiry_window_days = p_expiry_window_days
  where id = v_shop returning * into v_row;
  return v_row;
end $$;

-- ─── Execute grants: signed-in users only ────────────────────────────────────

revoke execute on function
  public.my_shop_id(), public.is_manager(),
  public.create_product(text, text, text, text, int, date, int),
  public.restock(uuid, int, date),
  public.set_count(uuid, int, date),
  public.update_product(uuid, text, text, int),
  public.delete_product(uuid),
  public.update_shop(text, int)
from public, anon;

grant execute on function
  public.my_shop_id(), public.is_manager(),
  public.create_product(text, text, text, text, int, date, int),
  public.restock(uuid, int, date),
  public.set_count(uuid, int, date),
  public.update_product(uuid, text, text, int),
  public.delete_product(uuid),
  public.update_shop(text, int)
to authenticated;
