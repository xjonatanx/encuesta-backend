const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const verifyToken = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/admin/alertas-full", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1. Obtener el total de alertas (recomendacion <= 5) usando Prisma
    const total = await prisma.survey.count({
      where: {
        recomendacion: {
          lte: 5, // lte significa "Less Than or Equal" (<=)
        },
      },
    });

    // 2. Obtener los datos paginados
    const rows = await prisma.survey.findMany({
      where: {
        recomendacion: {
          lte: 5,
        },
      },
      orderBy: {
        createdAt: "desc", // O usa 'fecha' si tienes ese campo específico
      },
      take: limit, // Esto es el LIMIT
      skip: skip, // Esto es el OFFSET
      include: {
        user: {
          select: { rut: true },
        },
      },
    });

    // 3. Formatear la respuesta para que el Front la entienda
    // (Aplanamos el objeto para que 'rut' esté al mismo nivel que 'rec')
    const formattedData = rows.map((e) => ({
      rut: e.user?.rut,
      rec: e.recomendacion,
      turno: e.turno,
    }));

    res.json({
      data: formattedData,
      total: total,
      page: page,
      limit: limit,
    });
  } catch (error) {
    console.error("Error en alertas-full:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

app.get("/api/admin/stats-full", verifyToken, async (req, res) => {
  try {
    const encuestas = await prisma.survey.findMany({
      orderBy: { createdAt: "desc" },
      include: { user: { select: { rut: true } } },
    });

    if (encuestas.length === 0) return res.json({ error: "No hay datos" });

    const total = encuestas.length;
    const dimensiones = [
      "equipo",
      "puesto",
      "empresa",
      "jefatura",
      "condiciones",
    ];

    const resumenRadar = {
      equipo: 0,
      puesto: 0,
      empresa: 0,
      jefatura: 0,
      condiciones: 0,
    };
    const radarCounts = {
      equipo: 0,
      puesto: 0,
      empresa: 0,
      jefatura: 0,
      condiciones: 0,
    };
    const turnosData = {
      "G1 DIA": { suma: 0, count: 0, emociones: {} },
      "G2 NOCHE": { suma: 0, count: 0, emociones: {} },
      "G3 DIA": { suma: 0, count: 0, emociones: {} },
      "G4 NOCHE": { suma: 0, count: 0, emociones: {} },
    };
    const distribucion = {
      "Crítico (1-3)": 0,
      "Bajo (4-5)": 0,
      "Medio (6-7)": 0,
      "Alto (8-9)": 0,
      "Excelencia (10)": 0,
    };
    const jefes = {};
    const alertas = [];
    let conteoEstres = 0;
    let sumaSeguridad = 0;

    encuestas.forEach((e) => {
      const rec = e.recomendacion || 0;

      // Métrica 2: Histograma
      if (rec <= 3) distribucion["Crítico (1-3)"]++;
      else if (rec <= 5) distribucion["Bajo (4-5)"]++;
      else if (rec <= 7) distribucion["Medio (6-7)"]++;
      else if (rec <= 9) distribucion["Alto (8-9)"]++;
      else distribucion["Excelencia (10)"]++;

      // Métrica 3 y 11: Radar y Seguridad
      dimensiones.forEach((dim) => {
        const valores = Object.values(e.respuestas?.[dim] || {});
        if (valores.length > 0) {
          const promDim = valores.reduce((a, b) => a + b, 0) / valores.length;
          resumenRadar[dim] += promDim;
          radarCounts[dim]++;
          if (dim === "condiciones") sumaSeguridad += promDim;
        }
      });

      // Métrica 5 y 6: Emociones y Estrés
      if (turnosData[e.turno]) {
        turnosData[e.turno].suma += rec;
        turnosData[e.turno].count++;
        Object.entries(e.emociones || {}).forEach(([emo, val]) => {
          if (val === true) {
            turnosData[e.turno].emociones[emo] =
              (turnosData[e.turno].emociones[emo] || 0) + 1;
            if (emo === "Estrés" || emo === "Frustración") conteoEstres++;
          }
        });
      }

      // Métrica 7: Cálculo basado en Jefe Directo
      if (e.jefeDirecto) {
        if (!jefes[e.jefeDirecto]) {
          jefes[e.jefeDirecto] = { suma: 0, count: 0 };
        }
        // Se usa la recomendación (NPS) como nota para el Jefe Directo
        jefes[e.jefeDirecto].suma += rec;
        jefes[e.jefeDirecto].count++;
      }

      // Métrica 8: Alertas
      if (rec <= 4 && (e.emociones?.Estrés || e.emociones?.Frustración)) {
        alertas.push({
          rut: e.user?.rut,
          jefe: e.jefeDirecto,
          puntaje: rec,
          turno: e.turno,
        });
      }
    });

    const promDia =
      (turnosData["G1 DIA"].suma + turnosData["G3 DIA"].suma) /
      (turnosData["G1 DIA"].count + turnosData["G3 DIA"].count || 1);
    const promNoche =
      (turnosData["G2 NOCHE"].suma + turnosData["G4 NOCHE"].suma) /
      (turnosData["G2 NOCHE"].count + turnosData["G4 NOCHE"].count || 1);

    res.json({
      nps: (
        encuestas.reduce((a, b) => a + (b.recomendacion || 0), 0) / total
      ).toFixed(1), // M1
      distribucion: Object.entries(distribucion).map(([label, value]) => ({
        label,
        value,
      })), // M2
      radar: dimensiones.map((d) =>
        radarCounts[d] > 0 ? (resumenRadar[d] / radarCounts[d]).toFixed(2) : 0,
      ), // M3
      brecha: {
        dia: promDia.toFixed(1),
        noche: promNoche.toFixed(1),
        diff: Math.abs(promDia - promNoche).toFixed(1),
      }, // M4
      statsTurnos: Object.keys(turnosData).map((t) => ({
        nombre: t,
        emociones: turnosData[t].emociones,
      })), // M5
      tasaEstres: ((conteoEstres / total) * 100).toFixed(1), // M6
      rankingJefes: Object.entries(jefes)
        .map(([name, d]) => ({
          name: name,
          avg: (d.suma / d.count).toFixed(1),
        }))
        .sort((a, b) => b.avg - a.avg), // M7
      alertasCount: alertas.length, // M8
      alertasDetalle: alertas,
      prioridades: dimensiones
        .map((d) => ({
          area: d.toUpperCase(),
          avg:
            radarCounts[d] > 0
              ? (resumenRadar[d] / radarCounts[d]).toFixed(2)
              : 0,
        }))
        .sort((a, b) => a.avg - b.avg)
        .slice(0, 3), // M9
      fidelizacion:
        radarCounts["empresa"] > 0
          ? ((resumenRadar["empresa"] / radarCounts["empresa"]) * 20).toFixed(1)
          : 0, // M10
      seguridad: (sumaSeguridad / (radarCounts["condiciones"] || 1)).toFixed(1), // M11
      cobertura: Object.entries(turnosData).map(([name, d]) => ({
        name,
        count: d.count,
      })), // M12
      totalEncuestas: total,
      ultimas: encuestas.slice(0, 8).map((e) => ({
        rut: e.user?.rut,
        rec: e.recomendacion,
        turno: e.turno,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/admin/login", async (req, res) => {
  // Cambiamos 'user' por 'email' para que coincida con la tabla
  const { user, pass } = req.body;

  try {
    // 1. Buscamos al administrador por su email (o nombre de usuario)
    const admin = await prisma.admin.findUnique({
      where: { email: user },
    });

    // 2. Si no existe el admin, cortamos de inmediato
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Usuario o contraseña incorrectos",
      });
    }

    // 3. Comparamos la contraseña enviada con el hash guardado en la DB
    const validPassword = await bcrypt.compare(pass, admin.password);

    if (validPassword) {
      // 4. Creamos el Token incluyendo el ID o Email del admin
      const token = jwt.sign(
        { id: admin.id, role: "admin" },
        process.env.JWT_SECRET,
        { expiresIn: "8h" },
      );

      return res.json({
        success: true,
        token: token,
      });
    }

    // Si la contraseña no coincide
    return res.status(401).json({
      success: false,
      message: "Usuario o contraseña incorrectos",
    });
  } catch (error) {
    console.error("Error en login:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
});

// 1. LOGIN: Ingreso por RUT y carga de borrador
app.post("/api/auth/login", async (req, res) => {
  const { rut } = req.body;
  const JWT_SECRET = process.env.JWT_SECRET;

  try {
    let user = await prisma.user.findUnique({
      where: { rut },
      include: { survey: true },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { rut, survey: { create: { status: "DRAFT" } } },
        include: { survey: true },
      });
    }

    if (user.survey?.status === "COMPLETED") {
      return res
        .status(403)
        .json({ message: "Usted ya ha completado esta encuesta." });
    }

    // --- GENERACIÓN DEL TOKEN ---
    // Guardamos el ID y el RUT dentro del token
    const token = jwt.sign(
      { id: user.id, rut: user.rut },
      JWT_SECRET,
      { expiresIn: "8h" }, // El token durará toda la jornada laboral
    );

    // Devolvemos los datos del usuario + el token
    res.json({
      id: user.id,
      rut: user.rut,
      token: token,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. RECUPERAR: Obtener la encuesta actual por ID de usuario
app.get("/api/survey/:userId", verifyToken, async (req, res) => {
  try {
    const survey = await prisma.survey.findUnique({
      where: { userId: parseInt(req.params.userId) },
    });
    res.json(survey);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener la encuesta" });
  }
});

// 3. GUARDAR: Ruta unificada para guardar progreso y finalizar
app.patch("/api/survey/save", verifyToken, async (req, res) => {
  // Nota: En el frontend asegúrate de enviar 'data' o 'datos'.
  // Aquí usamos 'data' para ser consistentes con tu frontend anterior.
  const { userId, data, status, lastStep } = req.body;

  console.log("--- PETICIÓN DE GUARDADO ---");
  console.log("ID Usuario:", userId);
  console.log("Supervisor recibido:", data?.supervisor);

  if (!userId) return res.status(400).json({ error: "Falta userId" });

  try {
    const updatedSurvey = await prisma.survey.update({
      where: { userId: parseInt(userId) },
      data: {
        cargo: data.cargo,
        jefeDirecto: data.jefeDirecto,
        supervisor: data.supervisor, // Ahora sí se guardará
        turno: data.turno,
        respuestas: data.respuestas,
        emociones: data.emociones,
        recomendacion: data.recomendacion,
        mejoras: data.mejoras,
        destacados: data.destacados,
        status: status || "DRAFT",
        lastStep: lastStep || 0,
      },
    });
    console.log("EXITO: Registro actualizado");
    res.json(updatedSurvey);
  } catch (error) {
    console.error("ERROR DE PRISMA:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3002, () => console.log("Backend corriendo en el puerto 3002"));
