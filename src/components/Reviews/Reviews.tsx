"use client";

interface ReviewItem {
    id: string;
    name: string;
    date: string;
    text: string;
}

const mockReviews: ReviewItem[] = [
    {
        id: "1",
        name: "Евгений",
        date: "15.05.2026, 14:16",
        text: "Хороший обменный пункт, курс радует, будем работать",
    },
    {
        id: "2",
        name: "Лев",
        date: "13.05.2026, 18:06",
        text: "Все хорошо",
    },
    {
        id: "3",
        name: "Виктория",
        date: "12.05.2026, 16:35",
        text: "Все оперативно, спасибо!",
    },
];

export default function Reviews() {
    return (
        <div className="bg-white p-6 rounded-3xl border border-gray-100/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-4">
            <h3 className="text-zinc-900 font-bold text-xl mb-1">Отзывы</h3>

            <div className="space-y-3">
                {mockReviews.map((review) => (
                    <div
                        key={review.id}
                        className="border border-gray-100 rounded-2xl p-4 text-sm"
                    >
                        <div className="flex justify-between items-baseline mb-2">
                            <span className="font-bold text-zinc-800">
                                {review.name},
                            </span>
                            <span className="text-[11px] text-zinc-400">
                                {review.date}
                            </span>
                        </div>
                        <p className="text-zinc-600 leading-relaxed">
                            {review.text}
                        </p>
                    </div>
                ))}
            </div>

            <button
                type="button"
                className="w-full text-center py-3 border border-yellow-400 text-zinc-800 font-medium text-sm rounded-full hover:bg-yellow-50 active:scale-[0.99] transition-all mt-2 cursor-pointer"
            >
                Все отзывы
            </button>
        </div>
    );
}
