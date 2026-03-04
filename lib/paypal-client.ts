import axios from "axios";
import { vault } from "@/lib/javari/secrets/vault";
export async function getPayPalAccessToken() {
  const clientId = await vault.get("PAYPAL_CLIENT_ID");
  const clientSecret = await vault.get("PAYPAL_CLIENT_SECRET");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await axios.post(
    "https://api-m.paypal.com/v1/oauth2/token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return response.data.access_token;
}
