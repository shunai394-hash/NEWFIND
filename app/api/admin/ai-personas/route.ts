import { NextResponse } from "next/server";

import { createAiPersona } from "@/lib/ai-personas";
import { getRequestAuth } from "@/lib/auth/request-user";

export async function POST(request: Request) {
  try {
    const auth = await getRequestAuth();

    if (!auth.userId || !auth.admin) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    if (!body.avatarUrl) {
      return NextResponse.json(
        { error: "avatar required" },
        { status: 400 },
      );
    }

    const persona = await createAiPersona({
      username: body.username,
      displayName: body.displayName,
      personaName: body.personaName,
      personality: body.personality,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      interests: body.interests,
      preferredCategories: body.preferredCategories,
      favoriteBrands: body.favoriteBrands,
      postingStyle: body.postingStyle,
      commentStyle: body.commentStyle,
      activityLevel: body.activityLevel,
      systemPrompt: body.systemPrompt,
      residentRole: body.residentRole,
      goals: body.goals,
      countryCode: body.countryCode,
      region: body.region,
      languages: body.languages,
      expertise: body.expertise,
      values: body.values,
      culture: body.culture,
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (error) {
    console.error("AI persona creation failed:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create AI persona",
      },
      { status: 500 },
    );
  }
}


