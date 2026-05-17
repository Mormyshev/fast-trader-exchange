"use client";

import { useState, useEffect } from "react";
import { X, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../app/context/AuthContext";

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
    const [login, setLogin] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const { loginUser } = useAuth();

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            setError(""); // Сбрасываем ошибку при открытии
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const success = loginUser(login, password);

        if (success) {
            onClose(); // Закрываем модалку при успешном входе
        } else {
            setError("Неверный логин или пароль");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="absolute inset-0" onClick={onClose} />
            <div className="relative w-full max-w-[480px] bg-white text-zinc-900 rounded-[32px] p-8 md:p-10 shadow-2xl z-10 border border-zinc-100">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-600"
                >
                    <X className="w-5 h-5" />
                </button>
                <h2 className="text-xl md:text-2xl font-bold text-center text-[#2A2A2A] mb-6">
                    Авторизация
                </h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <div className="text-xs font-bold text-red-500 text-center bg-red-50 py-2 rounded-full">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-500 pl-1">
                            Логин или e-mail *
                        </label>
                        <input
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium shadow-[0_0_12px_rgba(255,221,45,0.15)] focus:outline-hidden focus:border-[#FFDD2D]"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-semibold text-zinc-500 pl-1">
                            Пароль *
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full h-12 bg-white border border-zinc-200 rounded-full px-6 text-sm font-medium shadow-[0_0_12px_rgba(255,221,45,0.15)] focus:outline-hidden focus:border-[#FFDD2D]"
                            required
                        />
                    </div>

                    <div className="flex items-center space-x-4 pt-2">
                        <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl px-4 py-2 font-bold text-lg text-zinc-700 select-none">
                            6 + 6 =
                        </div>
                        <input
                            type="number"
                            className="w-12 h-12 bg-white border border-zinc-200 rounded-full text-center font-bold focus:outline-hidden focus:border-[#FFDD2D]"
                            required
                        />
                        <button type="button" className="p-2 text-amber-400">
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-[#FFDD2D] hover:bg-[#e6c628] text-zinc-900 font-bold py-3.5 rounded-full shadow-xs transition-all"
                        >
                            Войти
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
