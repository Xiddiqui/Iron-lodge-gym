-- Public bucket for gym images (member photos, staff photos, logo, landing page)
insert into storage.buckets (id, name, public)
values ('gym-assets', 'gym-assets', true)
on conflict (id) do update set public = true;

-- Anyone can read (bucket is public); only signed-in staff can upload/replace/delete
drop policy if exists "gym-assets public read" on storage.objects;
create policy "gym-assets public read" on storage.objects
  for select using (bucket_id = 'gym-assets');

drop policy if exists "gym-assets auth insert" on storage.objects;
create policy "gym-assets auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'gym-assets');

drop policy if exists "gym-assets auth update" on storage.objects;
create policy "gym-assets auth update" on storage.objects
  for update to authenticated using (bucket_id = 'gym-assets');

drop policy if exists "gym-assets auth delete" on storage.objects;
create policy "gym-assets auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'gym-assets');
