// prisma/seed.js
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  // 1. Hashear la contraseña (la que tenías en tu .env)
  const passwordHash = await bcrypt.hash("sN2S4zrnok", 10);

  // 2. Insertar o actualizar el administrador
  const admin = await prisma.admin.upsert({
    where: { email: "admin@pybingenieria.cl" }, // Cambia esto al email que desees
    update: {}, // Si ya existe, no hace nada
    create: {
      email: "natalia@pybingenieria.cl",
      nombre: "Admin P&B",
      password: passwordHash,
    },
  });

  console.log("✅ Usuario administrador creado con éxito:", admin.email);
}

main()
  .catch((e) => {
    console.error("❌ Error al insertar admin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
