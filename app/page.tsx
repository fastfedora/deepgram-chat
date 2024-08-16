"use client";

export const runtime = "edge";
import Conversation from "./components/Conversation";

export default function Home() {
  return (
    <>
      <div className="h-full overflow-hidden">
        {/* height 100% minus 8rem */}
        <main className="mx-auto max-w-7xl  px-4 md:px-6 lg:px-8 h-[calc(100%-8rem)]">
          <Conversation />
        </main>
      </div>
    </>
  );
}
