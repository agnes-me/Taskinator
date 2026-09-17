import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateCode, generateToken } from '@/lib/ids';
import { seedDefaultsForHousehold } from '@/lib/seed-defaults';

const schema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8),
  mode: z.enum(['create', 'join']),
  householdName: z.string().min(1).max(80).optional(),
  inviteCode: z.string().min(1).max(20).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Champs invalides.' }, { status: 400 });
  }
  const { name, email, password, mode, householdName, inviteCode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: 'Un compte existe déjà avec cet email.' }, { status: 409 });
  }

  let household;
  if (mode === 'join') {
    if (!inviteCode) {
      return NextResponse.json({ error: "Code d'invitation manquant." }, { status: 400 });
    }
    household = await prisma.household.findUnique({ where: { inviteCode: inviteCode.toUpperCase().trim() } });
    if (!household) {
      return NextResponse.json({ error: "Code d'invitation invalide." }, { status: 404 });
    }
  } else {
    if (!householdName) {
      return NextResponse.json({ error: 'Nom du foyer manquant.' }, { status: 400 });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash },
  });

  if (mode === 'join' && household) {
    await prisma.membership.create({
      data: { userId: user.id, householdId: household.id, role: 'MEMBER' },
    });
    await prisma.profile.create({
      data: { householdId: household.id, displayName: name, linkedUserId: user.id },
    });
  } else {
    household = await prisma.household.create({
      data: {
        name: householdName!,
        inviteCode: generateCode(6),
        icsToken: generateToken(32),
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, householdId: household.id, role: 'OWNER' },
    });
    await prisma.profile.create({
      data: { householdId: household.id, displayName: name, linkedUserId: user.id },
    });
    await seedDefaultsForHousehold(household.id);
  }

  return NextResponse.json({ ok: true });
}
