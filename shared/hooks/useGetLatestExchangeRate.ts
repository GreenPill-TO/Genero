import { useState, useEffect } from 'react';
import { createClient } from '@shared/lib/supabase/client';

export function useControlVariables() {
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchControlVariables() {
            // Replace "control variables" with your actual table name if needed.
            const supabase = createClient();
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