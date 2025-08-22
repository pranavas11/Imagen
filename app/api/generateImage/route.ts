import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Together from "together-ai";
import { z } from "zod";

let ratelimit: Ratelimit | undefined;

if (process.env.UPSTASH_REDIS_REST_URL) {
    ratelimit = new Ratelimit({
        redis: Redis.fromEnv(),
        limiter: Ratelimit.fixedWindow(100, "1440 m"),
        analytics: true,
        prefix: "imagen",
    });
}

export async function POST(req: Request) {
    try {
        let json = await req.json();
        let { prompt, userAPIKey, iterativeMode } = z.object({
            prompt: z.string(), 
            iterativeMode: z.boolean(), 
            userAPIKey: z.string().optional()
        }).parse(json);

        // Validate that we have some API key available
        const apiKey = userAPIKey || process.env.TOGETHER_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "No API key available. Please provide a Together API key." },
                { status: 400 }
            );
        }

        let options: ConstructorParameters<typeof Together>[0] = {
            apiKey: apiKey
        };

        if (process.env.HELICONE_API_KEY) {
            options.baseURL = "https://together.helicone.ai/v1";
            options.defaultHeaders = {
                "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
                "Helicone-Property-BYOK": userAPIKey ? "true" : "false",
            };
        }

        const client = new Together(options);

        if (ratelimit && !userAPIKey) {
            const identifier = getIPAddress();
            const { success } = await ratelimit.limit(identifier);

            if (!success) {
                return NextResponse.json(
                    { error: "No requests left. Please add your own API Key or try again in 24h" },
                    { status: 429 }
                );
            }
        }

        console.log("Generating image with prompt:", prompt);
        
        const response = await client.images.create({
            prompt,
            model: "black-forest-labs/FLUX.1-schnell",
            width: 1024,
            height: 768,
            seed: iterativeMode ? 123 : undefined,
            steps: 3,
            // @ts-expect-error - Together API supports this
            response_format: "base64",
        });

        console.log("Image generated successfully");
        return NextResponse.json(response.data[0]);

    } catch (e: any) {
        console.error("Error generating image:", e);
        return NextResponse.json(
            { error: e.message || "Failed to generate image" },
            { status: 500 }
        );
    }
}

function getIPAddress() {
    const FALLBACK_IP_ADDRESS = "0.0.0.0";
    const forwardedFor = headers().get("x-forwarded-for");

    if (forwardedFor) {
        return forwardedFor.split(",")[0] ?? FALLBACK_IP_ADDRESS;
    }

    return headers().get("x-real-ip") ?? FALLBACK_IP_ADDRESS;
}