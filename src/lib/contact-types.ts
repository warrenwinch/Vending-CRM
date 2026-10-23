// Contact shape, safe to use in browser code and on the server.

export type Contact = {
  id: string;
  client_id: string;
  location_id: string | null; // null = covers the whole client, not one site
  full_name: string;
  role_title: string | null;
  phone: string | null;
  email: string | null;
  is_main_contact: boolean;
  notes: string | null;
  site_name: string | null;
};
