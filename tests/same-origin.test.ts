import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { allowedRequestHosts, isSameOriginRequest } from "../lib/same-origin";

function req(url: string, headers: Record<string, string>) {
  return new NextRequest(url, { headers });
}

test("allows Origin matching public Host behind reverse proxy", () => {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://tanse.smai-alazhar1.com";
  try {
    const request = req("http://app:3000/api/account/password", {
      origin: "https://tanse.smai-alazhar1.com",
      host: "app:3000",
      "x-forwarded-host": "tanse.smai-alazhar1.com",
    });
    assert.equal(isSameOriginRequest(request), true);
    assert.ok(allowedRequestHosts(request).has("tanse.smai-alazhar1.com"));
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});

test("allows Origin matching NEXTAUTH_URL even when nextUrl host is internal", () => {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://tanse.smai-alazhar1.com";
  try {
    const request = req("http://127.0.0.1:3000/api/account/password", {
      origin: "https://tanse.smai-alazhar1.com",
      host: "127.0.0.1:3000",
    });
    assert.equal(isSameOriginRequest(request), true);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});

test("rejects cross-site Origin", () => {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://tanse.smai-alazhar1.com";
  try {
    const request = req("https://tanse.smai-alazhar1.com/api/account/password", {
      origin: "https://evil.example",
      host: "tanse.smai-alazhar1.com",
    });
    assert.equal(isSameOriginRequest(request), false);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});

test("falls back to Referer when Origin is missing", () => {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://tanse.smai-alazhar1.com";
  try {
    const request = req("http://app:3000/api/account/password", {
      referer: "https://tanse.smai-alazhar1.com/dashboard",
      host: "app:3000",
      "x-forwarded-host": "tanse.smai-alazhar1.com",
    });
    assert.equal(isSameOriginRequest(request), true);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});

test("allows Sec-Fetch-Site same-origin even if Origin not in allowed Docker hosts", () => {
  const previous = process.env.NEXTAUTH_URL;
  delete process.env.NEXTAUTH_URL;
  try {
    const request = req("http://app:3000/api/records", {
      origin: "https://tanse.smai-alazhar1.com",
      host: "app:3000",
      "sec-fetch-site": "same-origin",
    });
    assert.equal(isSameOriginRequest(request), true);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});

test("rejects cross-site Sec-Fetch-Site even with session-like Host", () => {
  const previous = process.env.NEXTAUTH_URL;
  process.env.NEXTAUTH_URL = "https://tanse.smai-alazhar1.com";
  try {
    const request = req("https://tanse.smai-alazhar1.com/api/records", {
      origin: "https://evil.example",
      host: "tanse.smai-alazhar1.com",
      "sec-fetch-site": "cross-site",
    });
    assert.equal(isSameOriginRequest(request), false);
  } finally {
    if (previous === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = previous;
  }
});
