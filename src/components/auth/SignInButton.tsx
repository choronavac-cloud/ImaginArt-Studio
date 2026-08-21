
import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { googleSignIn, logout } from '@/services/auth';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function SignInButton() {
    const [user, setUser] = useState<User | null>(null);

    // This is simple, for real app we should use a proper auth state manager
    // or context, but for now this is ok.
    // Actually initAuth in auth.ts could be used if I restructured.
    
    // For simplicity, let's just trigger sign in and update user state.

    const handleSignIn = async () => {
        try {
            const authResult = await googleSignIn();
            if (authResult) {
                setUser(authResult.user);
            }
        } catch (e: any) {
            toast.error('Error al iniciar sesión: ' + e.message);
        }
    };

    const handleSignOut = async () => {
        try {
            await logout();
            setUser(null);
        } catch (e: any) {
             toast.error('Error al cerrar sesión: ' + e.message);
        }
    };

    return (
        <div className="flex items-center gap-2">
            {user ? (
                <div className="flex items-center gap-2">
                    {user.photoURL && <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full" />}
                    <Button variant="ghost" size="sm" onClick={handleSignOut}>Cerrar Sesión</Button>
                </div>
            ) : (
                <Button variant="default" size="sm" onClick={handleSignIn}>Iniciar Sesión</Button>
            )}
        </div>
    );
}
