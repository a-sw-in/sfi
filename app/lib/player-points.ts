import { supabase } from "./supabase";

export async function addPlayerPoints(phone: string, score: number) {
  const points = score / 1000;
  const { data, error } = await supabase.rpc("add_player_points", {
    p_phone: phone,
    p_points_to_add: points,
  });

  if (error) throw error;
  return Number(data);
}
