// @ts-nocheck
"use client";
import React, { useEffect, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@shared/lib/supabase/client";
import { useAuth } from "@shared/api/hooks/useAuth";
import { updateCubidDataInSupabase } from "@shared/api/services/supabaseService";
import { Card, CardContent, CardFooter, CardHeader } from "@shared/components/ui/Card";
import { Button } from "@shared/components/ui/Button";
import { cn } from "@shared/utils/classnames";
import { useForm } from "react-hook-form";

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

export default function NewWelcomePage() {
    const router = useRouter();
    const { userData } = useAuth();

    // Wallet state array; Continue button enabled only when wallets.length > 0
    const [wallets, setWallets] = useState([]);

    // State to track if username uniqueness is being checked
    const [isUsernameChecking, setIsUsernameChecking] = useState(false);

    // Initialize react-hook-form with default values and validations.
    const {
        register,
        handleSubmit,
        watch,
        setValue,
        formState: { errors, isValid, isSubmitting }
    } = useForm({
        mode: "onBlur",
        defaultValues: {
            username: "",
            name: "",
            avatar: null,
        },
    });

    // Watch form values (file objects are non-serializable so we persist only username and name)
    const formData = watch();

    // On mount, load saved data from localStorage (excluding avatar)
    useEffect(() => {
        const storedData = localStorage.getItem("newWelcomeData");
        if (storedData) {
            const parsed = JSON.parse(storedData);
            if (parsed.username) setValue("username", parsed.username);
            if (parsed.name) setValue("name", parsed.name);
        }
    }, [setValue]);

    // Persist username and name to localStorage whenever they change
    useEffect(() => {
        const { avatar, ...persistData } = formData;
        localStorage.setItem("newWelcomeData", JSON.stringify(persistData));
    }, [formData]);

    // Handle form submission, including avatar upload and Supabase update
    const onSubmit = useCallback(
        async (data) => {
            try {
                if (!userData?.user?.cubid_id) {
                    console.error("No cubid_id found. Ensure user is authenticated properly.");
                    return;
                }

                let avatarUrl = "";
                // If an avatar file was selected, upload it to Supabase Storage
                if (data.avatar && data.avatar.length > 0) {
                    const avatarFile = data.avatar[0];
                    const filePath = `${userData.user.cubid_id}/${avatarFile.name}`;
                    const { error: uploadError } = await supabase.storage
                        .from("avatars")
                        .upload(filePath, avatarFile);
                    if (uploadError) {
                        console.error("Error uploading avatar:", uploadError.message);
                        return;
                    }
                    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
                    avatarUrl = data.publicUrl;
                }

                // Prepare updated user data
                const updatedData = {
                    username: data.username,
                    full_name: data.name,
                    profile_image_url: avatarUrl,
                };

                // Update data in Supabase
                const { error } = await updateCubidDataInSupabase(userData.user.cubid_id, updatedData);
                if (error) {
                    console.error("Error updating Supabase:", error.message);
                    return;
                }

                router.push("/dashboard");
            } catch (err) {
                console.error("Error submitting form:", err);
            }
        },
        [userData, router]
    );

    const mainClass = cn("flex-grow flex flex-col items-center justify-center p-4");

    return (
        <div className={mainClass}>
            <Card className="w-full max-w-xl">
                <CardHeader className="text-2xl font-semibold text-center mb-6">
                    <h1>Welcome</h1>
                    <p className="text-sm text-gray-600 mt-1">Please fill in the details below</p>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        {/* Username Field with Async Uniqueness Validation */}
                        <div className="mb-4">
                            <label htmlFor="username" className="block font-medium text-sm mb-2">
                                Username
                            </label>
                            <input
                                id="username"
                                type="text"
                                {...register("username", {
                                    required: "Username is required",
                                    validate: async (value) => {
                                        if (!value) return true; // required rule handles empty value.
                                        setIsUsernameChecking(true);
                                        const { data, error } = await supabase
                                            .from("users")
                                            .select("*")
                                            .eq("username", value);
                                        setIsUsernameChecking(false);
                                        if (error) return "Error validating username";
                                        if (data && data.length > 0) {
                                            return "Username already exists. Please choose another.";
                                        }
                                        return true;
                                    },
                                })}
                                className="w-full border border-gray-300 p-2 rounded dark:bg-gray-600 text-white"
                            />
                            {isUsernameChecking && (
                                <p className="text-blue-500 text-xs mt-1">Checking username...</p>
                            )}
                            {errors.username && (
                                <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>
                            )}
                        </div>

                        {/* Name Field with Required Validation */}
                        <div className="mb-4">
                            <label htmlFor="name" className="block font-medium text-sm mb-2">
                                Name
                            </label>
                            <input
                                id="name"
                                type="text"
                                {...register("name", { required: "Name is required" })}
                                className="w-full border border-gray-300 p-2 rounded dark:bg-gray-600 text-white"
                            />
                            {errors.name && (
                                <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>
                            )}
                        </div>

                        {/* Avatar File Upload */}
                        <div className="mb-4">
                            <label htmlFor="avatar" className="block font-medium text-sm mb-2">
                                Avatar
                            </label>
                            <input
                                id="avatar"
                                type="file"
                                accept="image/*"
                                {...register("avatar")}
                                className="w-full border border-gray-300 p-2 rounded dark:bg-gray-600 text-white"
                            />
                        </div>

                        <CardFooter className="flex justify-end">
                            {/* Continue button disabled if no wallet is connected, form is invalid, or submitting */}
                            <Button
                                type="submit"
                                className="ml-2"
                                disabled={wallets.length === 0 || !isValid || isSubmitting}
                            >
                                Continue
                            </Button>
                        </CardFooter>
                    </form>

                    {/* Render CubidWidget (phone variant) */}
                    <div className="mt-6">
                        <CubidWidget
                            stampToRender="phone"
                            uuid={userData?.user?.cubid_id}
                            page_id="37"
                            api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                        />
                    </div>

                    {/* Render WalletComponent and update wallets state */}
                    <div className="mt-6">
                        <WalletComponent
                            type="evm"
                            user_id={userData?.user?.cubid_id}
                            dapp_id="59"
                            api_key="14475a54-5bbe-4f3f-81c7-ff4403ad0830"
                            onEVMWallet={(walletArray) => {
                                setWallets(walletArray);
                                const [walletDetails] = wallet;
                                if (wallet.length) {
                                    await supabase.from("wallet_list").insert({
                                        public_key: walletDetails.address,
                                        user_id: userData?.cubidData?.id,
                                        is_generated: walletDetails?.is_generated_via_lib
                                    })
                                }
                            }}
                            onUserShare={async (usershare: any) => {
                                function bufferToBase64(buf) {
                                    return Buffer.from(buf).toString('base64');
                                }
                                const jsonData = {
                                    encryptedAesKey
                                        : bufferToBase64(usershare.encryptedAesKey),
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
                                    user_id: userData?.cubidData?.id,
                                })
                            }}
                            onAppShare={async (share: any) => {
                                if (share) {
                                    await supabase.from("wallet_appshare").insert({
                                        app_share: share,
                                        user_id: (userData?.cubidData as any)?.id
                                    })
                                }
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
