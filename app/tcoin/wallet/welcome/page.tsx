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
import useDarkMode from "@shared/hooks/useDarkMode";
import { toast } from "react-toastify";
import { dialCodes } from "@shared/utils/countryDialCodes";


// Dynamically import external components so they only render on the client
const WalletComponent = dynamic(
    () => import("cubid-wallet").then((mod) => mod.WalletComponent),
    { ssr: false }
);
const CubidWidget = dynamic(
    () => import("cubid-sdk").then((mod) => mod.CubidWidget),
    { ssr: false }
);


export default function NewWelcomePage() {
    const router = useRouter();
    const { userData, authData } = useAuth();

    // Multi-step: 1 = user details form, 2 = wallet connection, 3 = video demo
    const [step, setStep] = useState(1);
    const [wallets, setWallets] = useState([]);
    const [isPhoneVerified, setIsPhoneVerified] = useState(false);
    const [hasSuggestedUsername, setHasSuggestedUsername] = useState(false);
    const [usernameStatus, setUsernameStatus] = useState("idle");

    // Prepare country options using react-select-country-list and augment each with its dial code
    const customCountryOptions = useMemo(() => {
        const data = countryList().getData();
        return data.map((option) => ({
            ...option,
            label: `${option.label} (${dialCodes[option.value] || ""})`
        }));
    }, [])

    const { isDarkMode } = useDarkMode()

    // Initialize react-hook-form with our new fields.
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        setError,
        clearErrors,
        control,
        formState: { errors, isValid, isSubmitting }
    } = useForm({
        mode: "onBlur",
        defaultValues: {
            firstName: "",
            lastName: "",
            nickname: "",
            username: "",
            country: "",
            phone: ""
        }
    });

    // Persist form data if desired.
    const formData = watch();
    const usernameValue = watch("username") || "";
    const originalUsername = userData?.cubidData?.username?.trim() || "";
    const currentUsername = originalUsername.toLowerCase();
    const isUsernameReady = usernameStatus === "available" || usernameStatus === "current";
    const disableContinue = !isValid || isSubmitting || !isUsernameReady || usernameStatus === "checking";
    const usernameFeedback = (() => {
        switch (usernameStatus) {
            case "available":
                return { message: "Great choice! This username is available.", className: "text-green-600" };
            case "current":
                return { message: "This is your current username.", className: "text-gray-500" };
            case "checking":
                return { message: "Checking availability…", className: "text-gray-500" };
            default:
                return { message: "Choose a unique username to share with friends.", className: "text-gray-500" };
        }
    })();
    const continueHelper = (() => {
        switch (usernameStatus) {
            case "checking":
                return { message: "Checking username availability…", className: "text-gray-500" };
            case "taken":
                return { message: "That username is taken. Choose another to continue.", className: "text-red-500" };
            case "error":
                return {
                    message: "We couldn't confirm that username. Please try again.",
                    className: "text-red-500",
                };
            case "invalid":
                return {
                    message: "Usernames must be at least 3 characters.",
                    className: "text-red-500",
                };
            default:
                return null;
        }
    })();
    useEffect(() => {
        if (typeof window !== "undefined") {
            const storedData = window.localStorage.getItem("newWelcomeData");
            if (storedData) {
                const parsed = JSON.parse(storedData);
                if (parsed.firstName) setValue("firstName", parsed.firstName);
                if (parsed.lastName) setValue("lastName", parsed.lastName);
                if (parsed.nickname) setValue("nickname", parsed.nickname);
                if (parsed.username) {
                    setValue("username", parsed.username);
                    setHasSuggestedUsername(true);
                }
                if (parsed.country) setValue("country", parsed.country);
                if (parsed.phone) setValue("phone", parsed.phone);
            }
        }
    }, [setValue]);

    useEffect(() => {
        if (Boolean(userData?.cubidData?.full_name)) {
            router.replace('/dashboard')
        }
    }, [userData, router])

    useEffect(() => {
        if (!originalUsername || usernameValue) {
            return;
        }
        setValue("username", originalUsername.toLowerCase());
        setHasSuggestedUsername(true);
    }, [originalUsername, usernameValue, setValue]);

    useEffect(() => {
        if (userData?.cubidData?.phone) {
            setIsPhoneVerified(true);
        }
    }, [userData?.cubidData?.phone]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem("newWelcomeData", JSON.stringify(formData));
        }
    }, [formData]);

    useEffect(() => {
        if (hasSuggestedUsername) {
            return;
        }
        if (usernameValue) {
            setHasSuggestedUsername(true);
            return;
        }
        const email = authData?.user?.email?.trim();
        if (!email) {
            return;
        }
        const candidate = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        if (!candidate) {
            setHasSuggestedUsername(true);
            return;
        }
        let isActive = true;
        const checkAvailability = async () => {
            try {
                const supabase = createClient();
                const { count, error } = await supabase
                    .from("users")
                    .select("id", { count: "exact", head: true })
                    .ilike("username", candidate);
                if (!isActive) {
                    return;
                }
                if (!error && (count ?? 0) === 0) {
                    setValue("username", candidate);
                }
            } catch (err) {
                console.error("Failed to suggest username", err);
            } finally {
                if (isActive) {
                    setHasSuggestedUsername(true);
                }
            }
        };
        void checkAvailability();
        return () => {
            isActive = false;
        };
    }, [authData?.user?.email, hasSuggestedUsername, setValue, usernameValue]);

    useEffect(() => {
        if (!usernameValue) {
            setUsernameStatus("idle");
            clearErrors("username");
            return;
        }
        const sanitised = usernameValue.toLowerCase().replace(/[^a-z0-9._-]/g, "");
        if (sanitised !== usernameValue) {
            setValue("username", sanitised, { shouldValidate: true, shouldDirty: true });
            return;
        }
        if (currentUsername && sanitised === currentUsername) {
            setUsernameStatus("current");
            clearErrors("username");
            return;
        }
        if (sanitised.length < 3) {
            setUsernameStatus("invalid");
            setError("username", {
                type: "manual",
                message: "Usernames must be at least 3 characters.",
            });
            return;
        }
        setUsernameStatus("checking");
        clearErrors("username");
        let isActive = true;
        const timeout = setTimeout(async () => {
            try {
                const supabase = createClient();
                const { count, error } = await supabase
                    .from("users")
                    .select("id", { count: "exact", head: true })
                    .ilike("username", sanitised);
                if (!isActive) {
                    return;
                }
                if (error) {
                    throw error;
                }
                if ((count ?? 0) === 0) {
                    setUsernameStatus("available");
                    clearErrors("username");
                } else {
                    setUsernameStatus("taken");
                    setError("username", {
                        type: "manual",
                        message: "That username is already in use.",
                    });
                }
            } catch (err) {
                if (!isActive) {
                    return;
                }
                console.error("Failed to check username availability", err);
                setUsernameStatus("error");
                setError("username", {
                    type: "manual",
                    message: "Unable to confirm username availability. Please try again.",
                });
            }
        }, 400);
        return () => {
            isActive = false;
            clearTimeout(timeout);
        };
    }, [clearErrors, currentUsername, setError, setValue, usernameValue]);

    const upsertWalletKey = async (userId, payload = {}) => {
        const supabase = createClient();
        const namespace = payload.namespace || "EVM";
        const { data: keyData, error } = await supabase
            .from("wallet_keys")
            .upsert(
                {
                    user_id: userId,
                    namespace,
                    ...payload,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,namespace" }
            )
            .select("id")
            .single();

        if (error) {
            throw error;
        }

        return keyData.id;
    };

    const insertOrUpdateDataInWallet = async (userId, data) => {
        const supabase = createClient();
        const walletKeyId =
            data.wallet_key_id ??
            (await upsertWalletKey(userId, {
                namespace: data.namespace || "EVM",
                ...(typeof data.app_share === "string" ? { app_share: data.app_share } : {}),
            }));

        const walletPayload = {
            ...data,
            wallet_key_id: walletKeyId,
        };
        delete walletPayload.app_share;

        const { data: walletData } = await supabase
            .from("wallet_list")
            .select("id")
            .match({ user_id: userId, namespace: walletPayload.namespace || "EVM" })
            .limit(1);

        if (walletData?.[0]) {
            await supabase
                .from("wallet_list")
                .update(walletPayload)
                .match({ id: walletData[0].id });
        } else {
            await supabase.from("wallet_list").insert({
                user_id: userId,
                namespace: walletPayload.namespace || "EVM",
                ...walletPayload,
            });
        }

        return walletKeyId;
    };

    // Step 1: Submit the form and update the user’s data.
    const onSubmit = useCallback(
        async (data) => {
            if (!(usernameStatus === "available" || usernameStatus === "current")) {
                toast.error("Please choose an available username before continuing.");
                return;
            }
            try {
                if (!userData?.user?.cubid_id) {
                    console.error("No cubid_id found. Ensure user is authenticated properly.");
                    toast.error("We could not confirm your account. Please try signing in again.");
                    return;
                }

                const countryValue = (data.country?.label || data.country || "") as string;
                const updatedData = {
                    full_name: `${data.firstName} ${data.lastName}`.trim(),
                    nickname: data.nickname || null,
                    username: data.username?.toLowerCase() || null,
                    country: countryValue || null,
                    phone: data.phone || null,
                };

                const { error } = await updateCubidDataInSupabase(userData.user.cubid_id, {
                    user: updatedData,
                });
                if (error) {
                    console.error("Error updating Supabase:", error.message);
                    toast.error("We couldn't save your details. Please try again.");
                    return;
                }
                setStep(2);
            } catch (err) {
                console.error("Error submitting form:", err);
                toast.error("We couldn't save your details. Please try again.");
            }
        },
        [userData, usernameStatus]
    );

    const mainClass = cn("flex-grow flex flex-col items-center justify-center p-4");

    if (step === 1) {
        return (
            <div className={mainClass}>
                <Card className={`w-full text-black ${isDarkMode ? "text-white" : "text-black"} max-w-xl`}>
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
                                    style={{ color: "black !important" }}
                                    className={`w-full border border-gray-300 !bg-white p-2 rounded !text-black`}
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
                                    style={{ color: "black !important" }}
                                    {...register("lastName", { required: "Last name is required" })}
                                    className={`w-full border border-gray-300 p-2 !bg-white rounded  !text-black`}
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
                                    style={{ color: "black !important" }}
                                    {...register("nickname")}
                                    className={`w-full border border-gray-300 !bg-white p-2 rounded !text-black`}
                                />
                            </div>

                            {/* Username */}
                            <div className="mb-4">
                                <label htmlFor="username" className="block font-medium text-sm mb-1">
                                    Username
                                </label>
                                <p className="text-xs text-gray-500 mb-2">
                                    This will be your public handle so friends can find you.
                                </p>
                                <input
                                    id="username"
                                    type="text"
                                    autoComplete="off"
                                    {...register("username", {
                                        required: "Username is required",
                                        maxLength: {
                                            value: 32,
                                            message: "Usernames must be 32 characters or fewer.",
                                        },
                                        pattern: {
                                            value: /^[a-z0-9._-]+$/,
                                            message:
                                                "Use only lowercase letters, numbers, dots, underscores or hyphens.",
                                        },
                                    })}
                                    className={`w-full border border-gray-300 !bg-white p-2 rounded !text-black`}
                                />
                                {errors.username ? (
                                    <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
                                ) : (
                                    <p className={`text-xs mt-1 ${usernameFeedback.className}`}>
                                        {usernameFeedback.message}
                                    </p>
                                )}
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
                                            options={[{
                                                value: "CA",
                                                label: "Canada (+1)"
                                            }, ...customCountryOptions]}
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
                                <div className="rounded border border-gray-200 bg-white/80 p-3">
                                    <CubidWidget
                                        stampToRender="phone"
                                        uuid={userData?.user?.cubid_id}
                                        page_id='37'
                                        api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                                        onStampChange={() => {
                                            setIsPhoneVerified(true);
                                        }}
                                    />
                                    <p className={`text-xs mt-2 ${isPhoneVerified ? "text-green-600" : "text-gray-500"}`}>
                                        {isPhoneVerified
                                            ? "Phone number verified! You're good to go."
                                            : "Enter your phone number and verify it with the code we send."}
                                    </p>
                                </div>
                                {errors.phone && (
                                    <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>
                                )}
                            </div>

                            <CardFooter className="flex justify-end">
                                <div className="flex flex-col items-end gap-2">
                                    {continueHelper && (
                                        <p className={`text-xs ${continueHelper.className}`}>
                                            {continueHelper.message}
                                        </p>
                                    )}
                                    <Button type="submit" className="ml-2" disabled={disableContinue}>
                                        {isSubmitting ? "Saving..." : "Continue"}
                                    </Button>
                                </div>
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
                                        await insertOrUpdateDataInWallet(userData?.cubidData?.id, {
                                            public_key: walletDetails.address,
                                            is_generated: walletDetails?.is_generated_via_lib,
                                            namespace: "EVM",
                                        })
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
                                    const supabase = createClient();
                                    const walletKeyId = await upsertWalletKey(userData?.cubidData?.id, {
                                        namespace: "EVM",
                                    });
                                    await supabase.from("user_encrypted_share").insert({
                                        user_share_encrypted: jsonData,
                                        user_id: userData?.cubidData?.id,
                                        wallet_key_id: walletKeyId,
                                    });
                                }}
                                onAppShare={async (share) => {
                                    if (share) {
                                        setTimeout(async () => {
                                            await insertOrUpdateDataInWallet(userData?.cubidData?.id, {
                                                app_share: share,
                                                namespace: "EVM",
                                            })
                                        }, 1500)
                                    }
                                }}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <div className="flex flex-col items-end gap-2">
                            {wallets.length === 0 && (
                                <p className="text-xs text-gray-500">
                                    Connect a wallet above to enable this step.
                                </p>
                            )}
                            <Button onClick={() => setStep(3)} disabled={wallets.length === 0} className="ml-2">
                                Continue
                            </Button>
                        </div>
                    </CardFooter>
                </Card>
            </div>
        );
    } else if (step === 3) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-900">
                <h2 className="text-2xl font-semibold text-white mb-4">How to Fund Your Account</h2>
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
