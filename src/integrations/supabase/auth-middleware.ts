import { supabase } from "./client";

export const authMiddleware = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};
