import { isValidUUID } from "@shared/utils/validators";
import axios from "axios";

export const createCubidUser = async (fullContact: string, authMethod: "phone" | "email") => {
  try {
    const response = await axios.post("https://passport.cubid.me/api/dapp/create_user", {
      dapp_id: process.env.NEXT_PUBLIC_CUBID_API_KEY,
      email: fullContact,
      stamptype: authMethod === "email" ? "email" : "phone",
    });
    const { uuid } = response.data;

    if (!isValidUUID(uuid)) {
      throw new Error("Invalid UUID received from Cubid API");
    }

    return uuid;
  } catch (error) {
    console.error("Error creating Cubid user:", error);
    throw error;
  }
};

export const fetchCubidData = async (cubidId: string) => {
  try {
    const [score, identity, scoreDetails] = await Promise.all([
      axios.post("https://passport.cubid.me/api/dapp/fetch_score", {
        apikey: process.env.NEXT_PUBLIC_CUBID_API_KEY,
        uid: cubidId,
      }),
      axios.post("https://passport.cubid.me/api/dapp/get_identity", {
        apikey: process.env.NEXT_PUBLIC_CUBID_API_KEY,
        uid: cubidId,
      }),
      axios.post("https://passport.cubid.me/api/dapp/get_score_details", {
        apikey: process.env.NEXT_PUBLIC_CUBID_API_KEY,
        uid: cubidId,
      }),
    ]);

    return { score: score.data, identity: identity.data, scoreDetails: scoreDetails.data };
  } catch (error) {
    console.error("Error fetching Cubid data:", error);
    throw error;
  }
};
