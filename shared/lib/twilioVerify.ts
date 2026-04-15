export type TwilioVerifyConfig = {
  accountSid: string;
  authToken: string;
  verifyServiceSid: string;
};

type TwilioVerifyResponse = {
  status?: string;
  message?: string;
};

const PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const PASSCODE_PATTERN = /^\d{4,10}$/;

export function getTwilioVerifyConfig(
  env: NodeJS.ProcessEnv = process.env
): TwilioVerifyConfig | null {
  const accountSid = env.TWILIO_ACCOUNT_SID ?? env.accountSid;
  const authToken = env.TWILIO_AUTH_TOKEN ?? env.authToken;
  const verifyServiceSid =
    env.TWILIO_VERIFY_SERVICE_SID ?? env.verifyServiceSid;

  if (!accountSid || !authToken || !verifyServiceSid) {
    return null;
  }

  return { accountSid, authToken, verifyServiceSid };
}

export function normaliseTwilioPhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return PHONE_PATTERN.test(trimmed) ? trimmed : null;
}

export function normaliseTwilioPasscode(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return PASSCODE_PATTERN.test(trimmed) ? trimmed : null;
}

async function invokeTwilioVerifyEndpoint(
  config: TwilioVerifyConfig,
  path: "Verifications" | "VerificationCheck",
  formFields: Record<string, string>
) {
  const authHeader = Buffer.from(
    `${config.accountSid}:${config.authToken}`,
    "utf8"
  ).toString("base64");

  const response = await fetch(
    `https://verify.twilio.com/v2/Services/${config.verifyServiceSid}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(formFields).toString(),
    }
  );

  let payload: TwilioVerifyResponse = {};
  try {
    payload = (await response.json()) as TwilioVerifyResponse;
  } catch {
    payload = {};
  }

  return { response, payload };
}

export async function sendTwilioPasscode(
  config: TwilioVerifyConfig,
  phone: string
) {
  return invokeTwilioVerifyEndpoint(config, "Verifications", {
    To: phone,
    Channel: "sms",
  });
}

export async function verifyTwilioPasscode(
  config: TwilioVerifyConfig,
  phone: string,
  passcode: string
) {
  return invokeTwilioVerifyEndpoint(config, "VerificationCheck", {
    To: phone,
    Code: passcode,
  });
}
