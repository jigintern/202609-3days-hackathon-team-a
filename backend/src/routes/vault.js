import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Errors } from "../utils/errors.js";

export const vaultRouter = Router();

// Buffer.from(_, "base64") は不正な文字や余りビットを黙って捨てるため、
// 再エンコードして一致するか（正規のbase64か）まで確認する。
// これを省くと、ブラウザの atob() が受け付けない文字列を保存でき、復号不能な項目が残る。
function decodeBase64(value) {
  const buffer = Buffer.from(value, "base64");
  return buffer.toString("base64") === value ? buffer : null;
}

const base64String = z
  .string()
  .refine((v) => decodeBase64(v) !== null, "base64形式である必要があります");

// AES-GCMのIVは12バイト固定
const ivSchema = base64String.refine(
  (v) => decodeBase64(v)?.length === 12,
  "ivは12バイトである必要があります"
);

// AES-GCMの認証タグが16バイトあるため、暗号文は必ず17バイト以上になる。
// 平文をそのまま送ってしまう事故に対する最低限の歯止め。
const cipherTextSchema = base64String.refine((v) => {
  const length = decodeBase64(v)?.length;
  return length !== undefined && length >= 17 && length <= 8192;
}, "cipherTextが暗号文として不正です");

const profileSchema = z.object({
  kdfSalt: base64String.refine(
    (v) => decodeBase64(v)?.length === 16,
    "kdfSaltは16バイトである必要があります"
  ),
  kdfIterations: z.number().int().min(100000).max(2000000),
  verifierIv: ivSchema,
  verifierCipher: cipherTextSchema,
});

const entrySchema = z.object({
  iv: ivSchema,
  cipherText: cipherTextSchema,
});

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw Errors.validation(result.error.issues[0]?.message ?? "入力が不正です");
  }
  return result.data;
}

function serializeProfile(profile) {
  return {
    kdfSalt: profile.kdfSalt,
    kdfIterations: profile.kdfIterations,
    verifierIv: profile.verifierIv,
    verifierCipher: profile.verifierCipher,
  };
}

function serializeEntry(entry) {
  return {
    id: entry.id,
    iv: entry.iv,
    cipherText: entry.cipherText,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

vaultRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const profile = await prisma.vaultProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) throw Errors.notFound("保管庫が未設定です");

    res.json({ profile: serializeProfile(profile) });
  })
);

vaultRouter.post(
  "/profile",
  asyncHandler(async (req, res) => {
    const data = parse(profileSchema, req.body);

    // 存在確認してから作成すると二重送信で競合するため、一意制約違反を409に読み替える
    let profile;
    try {
      profile = await prisma.vaultProfile.create({
        data: { userId: req.user.id, ...data },
      });
    } catch (err) {
      if (err.code === "P2002") throw Errors.conflict("保管庫は既に設定されています");
      throw err;
    }

    res.status(201).json({ profile: serializeProfile(profile) });
  })
);

vaultRouter.get(
  "/entries",
  asyncHandler(async (req, res) => {
    const entries = await prisma.vaultEntry.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "asc" },
    });

    res.json({ entries: entries.map(serializeEntry) });
  })
);

vaultRouter.post(
  "/entries",
  asyncHandler(async (req, res) => {
    const data = parse(entrySchema, req.body);

    const profile = await prisma.vaultProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) throw Errors.validation("先に保管庫を設定してください");

    const entry = await prisma.vaultEntry.create({
      data: { userId: req.user.id, ...data },
    });

    res.status(201).json({ entry: serializeEntry(entry) });
  })
);

vaultRouter.patch(
  "/entries/:entryId",
  asyncHandler(async (req, res) => {
    const data = parse(entrySchema, req.body);

    const existing = await prisma.vaultEntry.findUnique({ where: { id: req.params.entryId } });
    if (!existing) throw Errors.notFound("該当の項目が見つかりません");
    if (existing.userId !== req.user.id) throw Errors.forbidden();

    const entry = await prisma.vaultEntry.update({
      where: { id: existing.id },
      data,
    });

    res.json({ entry: serializeEntry(entry) });
  })
);

vaultRouter.delete(
  "/entries/:entryId",
  asyncHandler(async (req, res) => {
    const existing = await prisma.vaultEntry.findUnique({ where: { id: req.params.entryId } });
    if (!existing) throw Errors.notFound("該当の項目が見つかりません");
    if (existing.userId !== req.user.id) throw Errors.forbidden();

    await prisma.vaultEntry.delete({ where: { id: existing.id } });

    res.status(204).end();
  })
);

// マスターパスワードを忘れた場合、サーバーは復号できないため作り直すしかない。
vaultRouter.delete(
  "/",
  asyncHandler(async (req, res) => {
    await prisma.$transaction([
      prisma.vaultEntry.deleteMany({ where: { userId: req.user.id } }),
      prisma.vaultProfile.deleteMany({ where: { userId: req.user.id } }),
    ]);

    res.status(204).end();
  })
);
