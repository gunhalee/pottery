alter table public.content_images
add column if not exists is_list_image boolean not null default false,
add column if not exists is_reserved boolean not null default false;

update public.content_images
set is_list_image = true
where is_cover = true
  and is_list_image = false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_images_reserved_exclusive_check'
      and conrelid = 'public.content_images'::regclass
  ) then
    alter table public.content_images
    add constraint content_images_reserved_exclusive_check
    check (
      not (
        is_reserved
        and (is_cover or is_detail or is_list_image)
      )
    );
  end if;
end $$;

create unique index if not exists content_images_one_list_image_idx
on public.content_images (entry_id)
where is_list_image;

create index if not exists content_images_entry_roles_idx
on public.content_images (entry_id, is_cover, is_list_image, is_detail, is_reserved);
