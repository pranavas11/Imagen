"use client";

import Spinner from "@/components/spinner";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useDebounce } from "@uidotdev/usehooks";
import { useQuery } from "@tanstack/react-query";

type ImageResponse = {
  b64_json: string;
  timings: { inference: number };
};

export default function Home() {
  const [userAPIKey, setUserAPIKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [iterativeMode, setIterativeMode] = useState(false);
  const debouncedPrompt = useDebounce(prompt, 300);
  const [generations, setGenerations] = useState<{ prompt: string; image: ImageResponse; }[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>();

  const { data: image, isFetching, error } = useQuery({
    placeholderData: (previousData) => previousData,
    queryKey: ["generateImage", debouncedPrompt, iterativeMode, userAPIKey],
    queryFn: async () => {
      console.log("Fetching image for prompt:", debouncedPrompt);
      
      const res = await fetch("/api/generateImage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          prompt: debouncedPrompt, 
          userAPIKey, 
          iterativeMode 
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("API Error:", errorText);
        throw new Error(errorText);
      }

      const result = await res.json();
      console.log("Image generation result:", result);
      return result as ImageResponse;
    },
    enabled: !!debouncedPrompt.trim(),
    staleTime: Infinity,
    retry: false,
  });

  const isDebouncing = prompt !== debouncedPrompt;

  useEffect(() => {
    if (image && !generations.find(g => g.image.b64_json === image.b64_json)) {
      console.log("Adding new generation to history");
      
      setGenerations((prevGenerations) => {
        const newGenerations = [...prevGenerations, { prompt: debouncedPrompt, image }];
        setActiveIndex(newGenerations.length - 1);
        return newGenerations;
      });
    }
  }, [image, debouncedPrompt]);

  const activeImage = activeIndex !== undefined ? generations[activeIndex]?.image : undefined;

  return (
    <div className="flex h-full flex-col px-5">
      <header className="flex justify-center pt-20 md:justify-end md:pt-3">
        <div className="flex-1">
          <h1 className="font-bold text-4xl bg-gradient-to-r from-pink-500 to-yellow-500 bg-clip-text text-transparent">
            Imagen
          </h1>
        </div>
        <div className="w-64">
          <label className="text-xs text-gray-200">
            [Optional] Add your{" "}
            <a
              href="https://api.together.xyz/settings/api-keys"
              target="_blank"
              className="underline underline-offset-4 transition hover:text-blue-500"
            >
              Together API Key
            </a>
          </label>
          <Input
            placeholder="API Key"
            type="password"
            value={userAPIKey}
            onChange={(e) => setUserAPIKey(e.target.value)}
            className="mt-1 bg-gray-400 text-gray-200 placeholder:text-gray-300"
          />
        </div>
      </header>

      <div className="flex justify-center">
        <form className="mt-10 w-full max-w-lg">
          <fieldset>
            <div className="relative">
              <Textarea
                rows={4}
                spellCheck={false}
                placeholder="Describe your image..."
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full resize-none border-gray-300 border-opacity-50 bg-gray-400 px-4 text-base placeholder-gray-300"
              />
              {(isFetching || isDebouncing) && (
                <div className="absolute right-3 top-3">
                  <Spinner className="size-4" />
                </div>
              )}
            </div>

            <div className="mt-3 text-sm md:text-right">
              <label
                title="Use earlier images as references"
                className="inline-flex items-center gap-2 text-gray-200"
              >
                Consistency mode
                <Switch
                  checked={iterativeMode}
                  onCheckedChange={setIterativeMode}
                />
              </label>
            </div>
          </fieldset>
        </form>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex justify-center mt-4">
          <div className="bg-red-900/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg max-w-lg">
            <p className="text-sm">Error: {error.message}</p>
          </div>
        </div>
      )}

      <div className="flex w-full grow flex-col items-center justify-center pb-8 pt-4 text-center">
        {!activeImage || !prompt ? (
          <div className="max-w-xl md:max-w-4xl lg:max-w-3xl">
            <p className="text-xl font-semibold text-gray-200 md:text-3xl lg:text-4xl">
              Generate images in real time
            </p>
            <p className="mt-4 text-balance text-sm text-gray-300 md:text-base lg:text-lg">
              Enter a prompt and generate images in milliseconds as you keep on typing.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex w-full max-w-4xl flex-col justify-center">
            <div className="flex justify-center">
              <Image
                width={1024}
                height={768}
                src={`data:image/png;base64,${activeImage.b64_json}`}
                alt={activeIndex !== undefined ? generations[activeIndex]?.prompt || "Generated image" : "Generated image"}
                className={`${
                  isFetching ? "animate-pulse" : ""
                } max-w-full rounded-lg object-cover shadow-sm shadow-black`}
                priority
              />
            </div>

            {generations.length > 1 && (
              <div className="mt-4 flex gap-4 overflow-x-scroll pb-4 justify-center">
                {generations.map((generatedImage, i) => (
                  <button
                    key={i}
                    className={`w-32 shrink-0 transition-opacity ${
                      activeIndex === i ? "opacity-100" : "opacity-50 hover:opacity-75"
                    }`}
                    onClick={() => setActiveIndex(i)}
                  >
                    <Image
                      width={1024}
                      height={768}
                      src={`data:image/png;base64,${generatedImage.image.b64_json}`}
                      alt={generatedImage.prompt}
                      className="max-w-full rounded-lg object-cover shadow-sm shadow-black"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}