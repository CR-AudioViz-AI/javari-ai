// [JAVARI-BUILD] Secret Authority

import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const getSecret = async (secretKey: string): Promise<string | null> => {
    try {
        const { data, error } = await supabase
            .from('secrets')
            .select('value')
            .eq('key', secretKey)
            .single();
        
        if (error) {
            console.error('Error fetching secret:', error);
            return null;
        }
        
        const decryptedValue = decryptAES256GCM(data.value); // Assuming decryptAES256GCM is a utility function you have.
        return decryptedValue;
    } catch (error) {
        console.error('Unexpected error:', error);
        return null;
    }
};

const decryptAES256GCM = (encrypted: string): string => {
    // Implementation for decryption based on AES-256-GCM
    // For now, this is a placeholder. Replace with actual decryption logic.
    return encrypted; // Placeholder. Replace with decryption logic.
};

const useSecret = (secretKey: string) => {
    const [secret, setSecret] = useState<string | null>(null);
    
    useEffect(() => {
        const fetchSecret = async () => {
            const fetchedSecret = await getSecret(secretKey);
            setSecret(fetchedSecret);
        };

        fetchSecret();
    }, [secretKey]);

    return secret;
};

export default useSecret;