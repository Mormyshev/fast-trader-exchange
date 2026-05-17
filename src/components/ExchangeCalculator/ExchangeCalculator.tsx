"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowLeftRight, ChevronDown, Check } from "lucide-react";

interface Currency {
    id: string;
    name: string;
    code: string;
    icon: string;
}

export default function ExchangeCalculator() {
    const [sendAmount, setSendAmount] = useState<string>("1000");
    const [receiveAmount, setReceiveAmount] = useState<string>("13.1789");
    const [isSendActive, setIsSendActive] = useState<boolean>(true);

    const fiatCurrencies: Currency[] = [
        { id: "rub_cash", name: "Наличные RUB", code: "RUB", icon: "💵" },
        { id: "rub_sber", name: "Сбербанк RUB", code: "RUB", icon: "🟢" },
        { id: "usd_cash", name: "Наличные USD", code: "USD", icon: "🇺🇸" },
    ];

    const cryptoCurrencies: Currency[] = [
        {
            id: "usdt_trc20",
            name: "Tether TRC20 USDT",
            code: "USDT",
            icon: "🟢",
        },
        {
            id: "usdt_erc20",
            name: "Tether ERC20 USDT",
            code: "USDT",
            icon: "🔷",
        },
        { id: "btc", name: "Bitcoin BTC", code: "BTC", icon: "🪙" },
    ];

    const [selectedSend, setSelectedSend] = useState<Currency>(
        fiatCurrencies[0],
    );
    const [selectedReceive, setSelectedReceive] = useState<Currency>(
        cryptoCurrencies[0],
    );

    const [isSendDropdownOpen, setIsSendDropdownOpen] = useState(false);
    const [isReceiveDropdownOpen, setIsReceiveDropdownOpen] = useState(false);

    const sendRef = useRef<HTMLDivElement>(null);
    const receiveRef = useRef<HTMLDivElement>(null);

    const EXCHANGE_RATE = 75.8786;
    const RESERVE = 50000000;

    useEffect(() => {
        if (isSendActive) {
            const num = parseFloat(sendAmount);
            setReceiveAmount(
                !isNaN(num) ? (num / EXCHANGE_RATE).toFixed(4) : "",
            );
        }
    }, [sendAmount]);

    useEffect(() => {
        if (!isSendActive) {
            const num = parseFloat(receiveAmount);
            setSendAmount(!isNaN(num) ? (num * EXCHANGE_RATE).toFixed(2) : "");
        }
    }, [receiveAmount]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                sendRef.current &&
                !sendRef.current.contains(event.target as Node)
            )
                setIsSendDropdownOpen(false);
            if (
                receiveRef.current &&
                !receiveRef.current.contains(event.target as Node)
            )
                setIsReceiveDropdownOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSwap = () => {
        const tempCurrency = selectedSend;
        setSelectedSend(selectedReceive);
        setSelectedReceive(tempCurrency);
        setIsSendActive(true);
        setSendAmount((parseFloat(receiveAmount) * EXCHANGE_RATE).toFixed(2));
    };

    return (
        // Убрали ограничение max-w-4xl, теперь компонент занимает 100% ширины своего родителя
        <div className="w-full">
            <div className="bg-white dark:bg-zinc-900 border-2 border-[#FFDD2D] rounded-[32px] p-6 md:p-10 shadow-xs relative">
                {/* Поля ввода */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative">
                    {/* Отправляете */}
                    <div
                        className="w-full flex-1 space-y-3 relative"
                        ref={sendRef}
                    >
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 pl-1">
                            Отправляете
                        </label>

                        <button
                            type="button"
                            onClick={() => {
                                setIsSendDropdownOpen(!isSendDropdownOpen);
                                setIsReceiveDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-3 shadow-xs text-left"
                        >
                            <div className="flex items-center space-x-3">
                                <span className="text-xl leading-none">
                                    {selectedSend.icon}
                                </span>
                                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                    {selectedSend.name}
                                </span>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-900 shrink-0">
                                <ChevronDown
                                    className={`w-4 h-4 transition-transform duration-200 ${isSendDropdownOpen ? "rotate-180" : ""}`}
                                />
                            </div>
                        </button>

                        {isSendDropdownOpen && (
                            <div className="absolute left-0 top-[88px] w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl py-2 z-50 max-h-60 overflow-y-auto">
                                {[...fiatCurrencies, ...cryptoCurrencies].map(
                                    (currency) => (
                                        <button
                                            key={currency.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedSend(currency);
                                                setIsSendDropdownOpen(false);
                                            }}
                                            className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className="text-lg leading-none">
                                                    {currency.icon}
                                                </span>
                                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    {currency.name}
                                                </span>
                                            </div>
                                            {selectedSend.id ===
                                                currency.id && (
                                                <Check className="w-4 h-4 text-zinc-900 dark:text-[#FFDD2D]" />
                                            )}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}

                        <input
                            type="number"
                            value={sendAmount}
                            onChange={(e) => {
                                setIsSendActive(true);
                                setSendAmount(e.target.value);
                            }}
                            className="w-full bg-[#FFFDE6] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-3.5 text-lg font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] transition-all"
                        />
                    </div>

                    {/* Стрелки реверса */}
                    <div className="relative md:top-5 flex items-center justify-center shrink-0">
                        <button
                            type="button"
                            onClick={handleSwap}
                            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 flex items-center justify-center text-[#FFDD2D] shadow-md hover:scale-105 active:scale-95 transition-all rotate-90 md:rotate-0"
                        >
                            <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Получаете */}
                    <div
                        className="w-full flex-1 space-y-3 relative"
                        ref={receiveRef}
                    >
                        <label className="block text-sm font-bold text-zinc-800 dark:text-zinc-200 pl-1">
                            Получаете
                        </label>

                        <button
                            type="button"
                            onClick={() => {
                                setIsReceiveDropdownOpen(
                                    !isReceiveDropdownOpen,
                                );
                                setIsSendDropdownOpen(false);
                            }}
                            className="w-full flex items-center justify-between bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-5 py-3 shadow-xs text-left"
                        >
                            <div className="flex items-center space-x-3">
                                <span className="text-xl leading-none">
                                    {selectedReceive.icon}
                                </span>
                                <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                    {selectedReceive.name}
                                </span>
                            </div>
                            <div className="w-6 h-6 rounded-full bg-[#FFDD2D] flex items-center justify-center text-zinc-900 shrink-0">
                                <ChevronDown
                                    className={`w-4 h-4 transition-transform duration-200 ${isReceiveDropdownOpen ? "rotate-180" : ""}`}
                                />
                            </div>
                        </button>

                        {isReceiveDropdownOpen && (
                            <div className="absolute left-0 top-[88px] w-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-xl py-2 z-50 max-h-60 overflow-y-auto">
                                {[...cryptoCurrencies, ...fiatCurrencies].map(
                                    (currency) => (
                                        <button
                                            key={currency.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedReceive(currency);
                                                setIsReceiveDropdownOpen(false);
                                            }}
                                            className="w-full px-5 py-2.5 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <span className="text-lg leading-none">
                                                    {currency.icon}
                                                </span>
                                                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                                                    {currency.name}
                                                </span>
                                            </div>
                                            {selectedReceive.id ===
                                                currency.id && (
                                                <Check className="w-4 h-4 text-zinc-900 dark:text-[#FFDD2D]" />
                                            )}
                                        </button>
                                    ),
                                )}
                            </div>
                        )}

                        <input
                            type="number"
                            value={receiveAmount}
                            onChange={(e) => {
                                setIsSendActive(false);
                                setReceiveAmount(e.target.value);
                            }}
                            className="w-full bg-[#FFFDE6] dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-900/20 rounded-full px-6 py-3.5 text-lg font-bold text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-[#FFDD2D] transition-all"
                        />
                    </div>
                </div>

                {/* Инфо */}
                <div className="mt-5 text-center md:text-right text-xs font-semibold text-zinc-400 dark:text-zinc-500 space-y-1 md:pr-4">
                    <div>
                        Курс: {EXCHANGE_RATE} {selectedSend.code} = 1{" "}
                        {selectedReceive.code}
                    </div>
                    <div>
                        Резерв: {RESERVE.toLocaleString("ru-RU")}{" "}
                        {selectedReceive.code}
                    </div>
                </div>

                {/* Кнопка */}
                <div className="mt-8">
                    <button
                        type="button"
                        className="w-full bg-[#FFDD2D] text-zinc-900 font-bold text-base py-4 rounded-full hover:bg-[#e6c628] shadow-xs active:scale-[0.99] transition-all"
                    >
                        Продолжить
                    </button>
                </div>
            </div>
        </div>
    );
}
