import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize the Supabase client (replace with your own keys/environment variables)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");

export function useControlVariables() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchControlVariables() {
            // Replace "control variables" with your actual table name if needed.
            const { data: controlData, error } = await supabase
                .from('control_variables')
                .select('*').match({ variable: 'exchange_rate' })

            if (error) {
                setError(error);
            } else {
                setData(controlData?.[0]);
            }
            setLoading(false);
        }

        fetchControlVariables();
    }, []);

    return { exchangeRate: data?.value || 3.35, error, loading };
}