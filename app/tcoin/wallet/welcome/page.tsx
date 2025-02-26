// @ts-nocheck
"use client";
import React, { useEffect, useCallback, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@shared/lib/supabase/client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { updateCubidDataInSupabase } from "@shared/api/services/supabaseService";
import { Card, CardContent, CardFooter, CardHeader } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/utils/classnames";
import { useForm, Controller } from "react-hook-form";

// Imports for country and phone input
import Select from "react-select";
import countryList from "react-select-country-list";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

const supabase = createClient();

// Dynamically import external components so they only render on the client
const WalletComponent = dynamic(
    () => import("cubid-wallet").then((mod) => mod.WalletComponent),
    { ssr: false }
);
const CubidWidget = dynamic(
    () => import("cubid-sdk").then((mod) => mod.CubidWidget),
    { ssr: false }
);

// A mapping from ISO country code to dial code.
const dialCodes = {
    AF: "+93",
    AL: "+355",
    DZ: "+213",
    AS: "+1-684",
    AD: "+376",
    AO: "+244",
    AI: "+1-264",
    AG: "+1-268",
    AR: "+54",
    AM: "+374",
    AW: "+297",
    AU: "+61",
    AT: "+43",
    AZ: "+994",
    BS: "+1-242",
    BH: "+973",
    BD: "+880",
    BB: "+1-246",
    BY: "+375",
    BE: "+32",
    BZ: "+501",
    BJ: "+229",
    BM: "+1-441",
    BT: "+975",
    BO: "+591",
    BA: "+387",
    BW: "+267",
    BR: "+55",
    IO: "+246",
    BN: "+673",
    BG: "+359",
    BF: "+226",
    BI: "+257",
    KH: "+855",
    CM: "+237",
    CA: "+1",
    CV: "+238",
    KY: "+1-345",
    CF: "+236",
    TD: "+235",
    CL: "+56",
    CN: "+86",
    CX: "+61",
    CC: "+61",
    CO: "+57",
    KM: "+269",
    CG: "+242",
    CD: "+243",
    CK: "+682",
    CR: "+506",
    CI: "+225",
    HR: "+385",
    CU: "+53",
    CW: "+599",
    CY: "+357",
    CZ: "+420",
    DK: "+45",
    DJ: "+253",
    DM: "+1-767",
    DO: "+1-809",
    EC: "+593",
    EG: "+20",
    SV: "+503",
    GQ: "+240",
    ER: "+291",
    EE: "+372",
    SZ: "+268",
    ET: "+251",
    FK: "+500",
    FO: "+298",
    FJ: "+679",
    FI: "+358",
    FR: "+33",
    GF: "+594",
    PF: "+689",
    GA: "+241",
    GM: "+220",
    GE: "+995",
    DE: "+49",
    GH: "+233",
    GI: "+350",
    GR: "+30",
    GL: "+299",
    GD: "+1-473",
    GP: "+590",
    GU: "+1-671",
    GT: "+502",
    GG: "+44-1481",
    GN: "+224",
    GW: "+245",
    GY: "+592",
    HT: "+509",
    HN: "+504",
    HK: "+852",
    HU: "+36",
    IS: "+354",
    IN: "+91",
    ID: "+62",
    IR: "+98",
    IQ: "+964",
    IE: "+353",
    IM: "+44-1624",
    IL: "+972",
    IT: "+39",
    JM: "+1-876",
    JP: "+81",
    JE: "+44-1534",
    JO: "+962",
    KZ: "+7",
    KE: "+254",
    KI: "+686",
    KP: "+850",
    KR: "+82",
    KW: "+965",
    KG: "+996",
    LA: "+856",
    LV: "+371",
    LB: "+961",
    LS: "+266",
    LR: "+231",
    LY: "+218",
    LI: "+423",
    LT: "+370",
    LU: "+352",
    MO: "+853",
    MG: "+261",
    MW: "+265",
    MY: "+60",
    MV: "+960",
    ML: "+223",
    MT: "+356",
    MH: "+692",
    MQ: "+596",
    MR: "+222",
    MU: "+230",
    YT: "+262",
    MX: "+52",
    FM: "+691",
    MD: "+373",
    MC: "+377",
    MN: "+976",
    ME: "+382",
    MS: "+1-664",
    MA: "+212",
    MZ: "+258",
    MM: "+95",
    NA: "+264",
    NR: "+674",
    NP: "+977",
    NL: "+31",
    NC: "+687",
    NZ: "+64",
    NI: "+505",
    NE: "+227",
    NG: "+234",
    NU: "+683",
    NF: "+672",
    MP: "+1-670",
    NO: "+47",
    OM: "+968",
    PK: "+92",
    PW: "+680",
    PS: "+970",
    PA: "+507",
    PG: "+675",
    PY: "+595",
    PE: "+51",
    PH: "+63",
    PN: "+64",
    PL: "+48",
    PT: "+351",
    PR: "+1-787",
    QA: "+974",
    RE: "+262",
    RO: "+40",
    RU: "+7",
    RW: "+250",
    BL: "+590",
    SH: "+290",
    KN: "+1-869",
    LC: "+1-758",
    MF: "+590",
    PM: "+508",
    VC: "+1-784",
    WS: "+685",
    SM: "+378",
    ST: "+239",
    SA: "+966",
    SN: "+221",
    RS: "+381",
    SC: "+248",
    SL: "+232",
    SG: "+65",
    SX: "+1-721",
    SK: "+421",
    SI: "+386",
    SB: "+677",
    SO: "+252",
    ZA: "+27",
    SS: "+211",
    ES: "+34",
    LK: "+94",
    SD: "+249",
    SR: "+597",
    SJ: "+47",
    SE: "+46",
    CH: "+41",
    SY: "+963",
    TW: "+886",
    TJ: "+992",
    TZ: "+255",
    TH: "+66",
    TL: "+670",
    TG: "+228",
    TK: "+690",
    TO: "+676",
    TT: "+1-868",
    TN: "+216",
    TR: "+90",
    TM: "+993",
    TC: "+1-649",
    TV: "+688",
    UG: "+256",
    UA: "+380",
    AE: "+971",
    GB: "+44",
    US: "+1",
    UM: "+1",
    UY: "+598",
    UZ: "+998",
    VU: "+678",
    VE: "+58",
    VN: "+84",
    VG: "+1-284",
    VI: "+1-340",
    WF: "+681",
    EH: "+212",
    YE: "+967",
    ZM: "+260",
    ZW: "+263"
};

export default function NewWelcomePage() {
    const router = useRouter();
    const { userData } = useAuth();

    // Multi-step: 1 = user details form, 2 = wallet connection, 3 = video demo
    const [step, setStep] = useState(1);
    const [wallets, setWallets] = useState([]);

    // Prepare country options using react-select-country-list and augment each with its dial code
    const customCountryOptions = useMemo(() => {
        const data = countryList().getData();
        return data.map((option) => ({
            ...option,
            label: `${option.label} (${dialCodes[option.value] || ""})`
        }));
    }, []);

    // Initialize react-hook-form with our new fields.
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        control,
        formState: { errors, isValid, isSubmitting }
    } = useForm({
        mode: "onBlur",
        defaultValues: {
            firstName: "",
            lastName: "",
            nickname: "",
            country: "",
            phone: ""
        }
    });

    // Persist form data if desired.
    const formData = watch();
    useEffect(() => {
        const storedData = localStorage.getItem("newWelcomeData");
        if (storedData) {
            const parsed = JSON.parse(storedData);
            if (parsed.firstName) setValue("firstName", parsed.firstName);
            if (parsed.lastName) setValue("lastName", parsed.lastName);
            if (parsed.nickname) setValue("nickname", parsed.nickname);
            if (parsed.country) setValue("country", parsed.country);
            if (parsed.phone) setValue("phone", parsed.phone);
        }
    }, [setValue]);

    useEffect(() => {
        localStorage.setItem("newWelcomeData", JSON.stringify(formData));
    }, [formData]);

    // Step 1: Submit the form and update the user’s data.
    const onSubmit = useCallback(
        async (data) => {
            try {
                if (!userData?.user?.cubid_id) {
                    console.error("No cubid_id found. Ensure user is authenticated properly.");
                    return;
                }

                const updatedData = {
                    full_name: `${data.firstName} ${data.lastName}`,
                    nickname: data.nickname,
                    country: data.country.label, // storing the ISO code (e.g., "CA")
                    phone: data.phone
                };

                const { error } = await updateCubidDataInSupabase(userData.user.cubid_id, updatedData);
                if (error) {
                    console.error("Error updating Supabase:", error.message);
                    return;
                }
                setStep(2);
            } catch (err) {
                console.error("Error submitting form:", err);
            }
        },
        [userData]
    );

    const mainClass = cn("flex-grow flex flex-col items-center justify-center p-4");

    if (step === 1) {
        return (
            <div className={mainClass}>
                <Card className="w-full text-black dark:text-white max-w-xl">
                    <CardHeader className="text-2xl font-semibold text-center mb-6">
                        <h1>Welcome</h1>
                        <p className="text-sm text-gray-600 mt-1">Please fill in the details below</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            {/* First Name */}
                            <div className="mb-4">
                                <label htmlFor="firstName" className="block font-medium text-sm mb-1">
                                    First Name
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Your legal first name(s)</p>
                                <input
                                    id="firstName"
                                    type="text"
                                    {...register("firstName", { required: "First name is required" })}
                                    className="w-full border border-gray-300 p-2 rounded dark:bg-gray-600"
                                />
                                {errors.firstName && (
                                    <p className="text-red-500 text-xs mt-1">{errors.firstName.message}</p>
                                )}
                            </div>

                            {/* Last Name */}
                            <div className="mb-4">
                                <label htmlFor="lastName" className="block font-medium text-sm mb-1">
                                    Last Name
                                </label>
                                <p className="text-xs text-gray-500 mb-2">Your legal last name or family name</p>
                                <input
                                    id="lastName"
                                    type="text"
                                    {...register("lastName", { required: "Last name is required" })}
                                    className="w-full border border-gray-300 p-2 rounded dark:bg-gray-600 "
                                />
                                {errors.lastName && (
                                    <p className="text-red-500 text-xs mt-1">{errors.lastName.message}</p>
                                )}
                            </div>

                            {/* Nickname (Optional) */}
                            <div className="mb-4">
                                <label htmlFor="nickname" className="block font-medium text-sm mb-1">
                                    Nickname (optional)
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    What should we call you? Lots of people go by different names from their given name
                                </p>
                                <input
                                    id="nickname"
                                    type="text"
                                    {...register("nickname")}
                                    className="w-full border border-gray-300 p-2 rounded dark:bg-gray-600"
                                />
                            </div>

                            {/* Country Selector */}
                            <div className="mb-4">
                                <label htmlFor="country" className="block font-medium text-sm mb-1">
                                    Country
                                </label>
                                <p className="text-xs text-gray-500 mb-2">In which country do you live?</p>
                                <Controller
                                    control={control}
                                    name="country"
                                    rules={{ required: "Country is required" }}
                                    render={({ field }) => (
                                        <Select
                                            {...field}
                                            options={customCountryOptions}
                                            className="!text-black"
                                            placeholder="Select a country"
                                        />
                                    )}
                                />
                                {errors.country && (
                                    <p className="text-red-500 text-xs mt-1">{errors.country.message}</p>
                                )}
                            </div>

                            {/* Phone Input with Country Code */}
                            <div className="mb-4">
                                <label htmlFor="phone" className="block font-medium text-sm mb-1">
                                    Phone
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    Enter your country code and phone number. We will only use this to send you notifications about transactions. You can opt out later.
                                </p>
                                <Controller
                                    control={control}
                                    name="phone"
                                    rules={{ required: "Phone number is required" }}
                                    render={({ field }) => (
                                        <PhoneInput
                                            {...field}
                                            inputStyle={{ width: "100%" }}
                                            className="!text-black"
                                            country={"us"}
                                            onChange={(value) => field.onChange(value)}
                                        />
                                    )}
                                />
                                {errors.phone && (
                                    <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
                                )}
                            </div>

                            <CardFooter className="flex justify-end">
                                <Button type="submit" className="ml-2" disabled={!isValid || isSubmitting}>
                                    Continue
                                </Button>
                            </CardFooter>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    } else if (step === 2) {
        return (
            <div className={mainClass}>
                <Card className="w-full max-w-xl">
                    <CardHeader className="text-2xl font-semibold text-center mb-6">
                        <h1>Connect Your Wallet</h1>
                        <p className="text-sm text-gray-600 mt-1">Please connect your wallet to continue</p>
                    </CardHeader>
                    <CardContent>
                        <div className="mt-6">
                            <WalletComponent
                                type="evm"
                                user_id={userData?.user?.cubid_id}
                                dapp_id="59"
                                api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                                onEVMWallet={async (walletArray: any) => {
                                    setWallets(walletArray);
                                    const [walletDetails] = walletArray;
                                    if (walletDetails) {
                                        await supabase.from("wallet_list").insert({
                                            public_key: walletDetails.address,
                                            user_id: userData?.cubidData?.id,
                                            is_generated: walletDetails?.is_generated_via_lib
                                        });
                                    }
                                }}
                                onUserShare={async (usershare: any) => {
                                    function bufferToBase64(buf) {
                                        return Buffer.from(buf).toString("base64");
                                    }
                                    const jsonData = {
                                        encryptedAesKey: bufferToBase64(usershare.encryptedAesKey),
                                        encryptedData: bufferToBase64(usershare.encryptedData),
                                        encryptionMethod: usershare.encryptionMethod,
                                        id: usershare.id,
                                        iv: bufferToBase64(usershare.iv),
                                        ivForKeyEncryption: usershare.ivForKeyEncryption,
                                        salt: usershare.salt,
                                        credentialId: bufferToBase64(usershare.credentialId)
                                    };
                                    await supabase.from("user_encrypted_share").insert({
                                        user_share_encrypted: jsonData,
                                        user_id: userData?.cubidData?.id
                                    });
                                }}
                                onAppShare={async (share) => {
                                    if (share) {
                                        await supabase.from("wallet_appshare").insert({
                                            app_share: share,
                                            user_id: userData?.cubidData?.id
                                        });
                                    }
                                }}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button onClick={() => setStep(3)} disabled={wallets.length === 0} className="ml-2">
                            Continue
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        );
    } else if (step === 3) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
                <h2 className="text-2xl font-semibold text-white mb-4">How to Top Up Your Account</h2>
                <video
                    src="https://kyxsjnwkvddgjqigdpsv.supabase.co/storage/v1/object/public/screen_recording/Screen%20Recording%202025-02-24%20at%206.54.17%20PM.mov"
                    controls
                    className="w-full max-w-2xl"
                />
                <Button onClick={() => router.push("/dashboard")} className="mt-6">
                    Continue to Dashboard
                </Button>
            </div>
        );
    }
    return null;
}
