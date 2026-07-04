"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Comment = {
  id: number;
  user: string;
  text: string;
  avatar: string;
};

type VisibleComment = Comment & {
  instanceId: number;
};

const COMMENTS_BY_INDEX: Comment[][] = [
  [
    { id: 1, user: "xSla1er", text: "HAHA čo to bolo 😱", avatar: "🟢" },
    { id: 2, user: "N1ghtmare", text: "RIP xD 💀", avatar: "🔵" },
    { id: 3, user: "Fraggo", text: "fail compilation", avatar: "🟣" },
    { id: 4, user: "PixelSlayer", text: "klip king z failov 👑", avatar: "🟡" },
    { id: 5, user: "Pr0Headshot", text: "smola chlape 💀", avatar: "🔴" },
    { id: 6, user: "c4merBoy", text: "hlavne že zdravie 😂", avatar: "🟢" },
    { id: 7, user: "Lurker_42", text: "omg najhorší clip", avatar: "🔵" },
    { id: 8, user: "GGWP", text: "aspoň zábavné 💯", avatar: "🟣" },
    { id: 9, user: "ClutchKing", text: "čakal som fail 💀", avatar: "🟡" },
    { id: 10, user: "RaidQueen", text: "toto je viral 😂", avatar: "🔴" }
  ],
  [
    { id: 21, user: "grinder_300", text: "king mindset 💪", avatar: "🟢" },
    { id: 22, user: "lev3l_up", text: "presne tak 👑", avatar: "🔵" },
    { id: 23, user: "hustleDad", text: "Tate vibes 🔥", avatar: "🟣" },
    { id: 24, user: "sigma_grind", text: "fakt 👑", avatar: "🟡" },
    { id: 25, user: "noDaysOff", text: "💯💯💯", avatar: "🔴" },
    { id: 26, user: "mindSet()", text: "pamätaj si to 🙏", avatar: "🟢" },
    { id: 27, user: "disciplineFirst", text: "Ďakujem za to ❤️", avatar: "🔵" },
    { id: 28, user: "alphaSwing", text: "winner", avatar: "🟣" },
    { id: 29, user: "topTierG_", text: "takto sa to robí 👑", avatar: "🟡" },
    { id: 30, user: "innerBeast", text: "fakt motivujúce 💪", avatar: "🔴" }
  ],
  [
    { id: 11, user: "vid3o_watcher", text: "hmm zaujímavé 👀", avatar: "🟢" },
    { id: 12, user: "t1kviewer", text: "čo to hovorí 🤔", avatar: "🔵" },
    { id: 13, user: "silent_one", text: "tak toto 👀", avatar: "🟣" },
    { id: 14, user: "night_owl", text: "presne 👌", avatar: "🟡" },
    { id: 15, user: "third_wheel", text: "rozhovor level 🏆", avatar: "🔴" },
    { id: 16, user: "anonymous_sk", text: "fakt silné", avatar: "🟢" },
    { id: 17, user: "lurker_8", text: "wow 😮", avatar: "🔵" },
    { id: 18, user: "commentor_x", text: "pokračuj", avatar: "🟣" },
    { id: 19, user: "viewer_42", text: "silný statement", avatar: "🟡" },
    { id: 20, user: "quiet_bystander", text: "niečo tu je 💯", avatar: "🔴" }
  ]
];

const ONLINE_COUNT = 2341;

export default function LiveChat({ activeIndex, likesCount }: { activeIndex: number; likesCount: number }) {
  const [visibleComments, setVisibleComments] = useState<VisibleComment[]>([]);

  useEffect(() => {
    setVisibleComments([]);
  }, [activeIndex]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const pool = COMMENTS_BY_INDEX[activeIndex] ?? COMMENTS_BY_INDEX[0];
      const randomComment = pool[Math.floor(Math.random() * pool.length)];
      setVisibleComments((previous) => {
        const updated = [...previous, { ...randomComment, instanceId: Date.now() + Math.random() }];
        return updated.length > 5 ? updated.slice(-5) : updated;
      });
    }, 2200);

    return () => window.clearInterval(interval);
  }, [activeIndex]);

  return (
    <div className="hidden h-[440px] max-w-[300px] flex-col rounded-2xl border border-emerald-400/20 bg-slate-900/80 p-3 backdrop-blur-md md:flex">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">💬 Live chat</span>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs text-emerald-300">❤️ {likesCount.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500">🟢 {ONLINE_COUNT.toLocaleString()} online</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2 overflow-hidden">
        <AnimatePresence initial={false}>
          {visibleComments.map((comment) => (
            <motion.div
              key={comment.instanceId}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg bg-slate-800/60 px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <span className="text-sm">{comment.avatar}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-emerald-200">{comment.user}</span>
                  <span className="ml-2 text-xs text-slate-200">{comment.text}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-2 border-t border-slate-700 pt-2">
        <div className="rounded bg-slate-800/50 px-2 py-1.5 text-xs text-slate-500">Pridať komentár…</div>
      </div>
    </div>
  );
}
