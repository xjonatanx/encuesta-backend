const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const verifyToken = require("./middleware/auth");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const puppeteer = require("puppeteer");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/admin/generate-pdf/:rut", verifyToken, async (req, res) => {
  const { rut } = req.params;

  try {
    // 1. Obtener los datos desde Prisma
    const user = await prisma.user.findUnique({
      where: { rut: rut },
      include: { survey: true },
    });

    if (!user || !user.survey) {
      return res
        .status(404)
        .json({ message: "No se encontró encuesta para este RUT" });
    }

    const { survey } = user;

    // 2. Definir el HTML
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: Arial, sans-serif; font-size: 11px; color: black; margin: 0; padding: 0; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            .uppercase { text-transform: uppercase; }
            .bold { font-weight: bold; }
            .bg-gris { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }

            /* Header ISO */
            .tabla-iso { border: 1.5pt solid black; margin-bottom: 0; }
            .tabla-iso td { border: 1pt solid black; padding: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

            /* Secciones */
            .seccion-titulo {
                border-bottom: 4pt solid #1a4479;
                color: #1a4479;
                font-size: 18px;
                font-weight: bold;
                padding: 8px 0;
                margin-top: 25px;
                width: 100%;
            }

            .pregunta-row { padding: 12px 0; border-bottom: 0.5pt solid #eee; page-break-inside: avoid; }
            .caja-voto {
                display: inline-block;
                border: 1.5pt solid #1a4479;
                padding: 4px 12px;
                margin-right: 8px;
                margin-top: 8px;
                border-radius: 4px;
                font-weight: bold;
                color: #1a4479;
            }
            .activa { background-color: #1a4479 !important; color: white !important; -webkit-print-color-adjust: exact; }

            /* Emociones y Footer */
            .tabla-final { border: 1.5pt solid black; width: 100%; margin-top: 20px; }
            .tabla-final td, .tabla-final th { border: 1pt solid black; padding: 12px; }
        </style>
    </head>
    <body>
        <table class="tabla-iso">
            <tr>
                <td rowspan="2" style="width: 15%; text-align: center;">
                    <img src="https://pybingenieriachile.cl/encuestas/images/logo_pb.png" style="max-height: 45px;">
                </td>
                <td style="width: 55%; text-align: center;" class="bg-gris">
                    <div class="bold">PROCEDIMIENTOS RR.HH.</div>
                    <div style="font-size: 9px;">Sistema de Gestión de la Calidad ISO 9001:2015</div>
                </td>
                <td style="width: 30%; font-size: 9px;">
                    <strong>CÓDIGO:</strong> —<br>
                    <strong>REVISIÓN:</strong> 0<br>
                    <strong>EMISIÓN:</strong> ${new Date(survey.createdAt).toLocaleDateString("es-CL")}
                </td>
            </tr>
            <tr>
                <td colspan="2" style="text-align: center;" class="bg-gris">
                    <div class="bold uppercase">Encuesta Clima Laboral</div>
                    <div style="font-size: 9px;">EXPEDIENTE DE AUDITORÍA INTERNA</div>
                </td>
            </tr>
        </table>

        <table class="tabla-iso" style="border-top: none;">
            <tr>
                <td style="width: 20%;"><strong>RUT:</strong> ${user.rut}</td>
                <td style="width: 25%;"><strong>CARGO:</strong> ${survey.cargo || "N/A"}</td>
                <td style="width: 35%;"><strong>JEFE DIRECTO:</strong> ${survey.jefeDirecto || "N/A"}</td>
                <td style="width: 20%;"><strong>TURNO:</strong> ${survey.turno || "N/A"}</td>
            </tr>
        </table>

        ${Object.entries(survey.respuestas || {})
          .map(
            ([seccion, preguntas]) => `
            <div class="seccion-titulo uppercase">${seccion}</div>
            ${Object.entries(preguntas)
              .map(
                ([idx, val]) => `
                <div class="pregunta-row">
                    <div><strong>${parseInt(idx) + 1}.-</strong> Pregunta correspondiente a la sección</div>
                    <div>
                        ${[1, 2, 3, 4, 5]
                          .map(
                            (n) => `
                            <span class="caja-voto ${val == n ? "activa" : ""}">${n}</span>
                        `,
                          )
                          .join("")}
                    </div>
                </div>
            `,
              )
              .join("")}
        `,
          )
          .join("")}

        <div class="seccion-titulo">RESPECTO A SUS EMOCIONES</div>
        <table class="tabla-final">
            <thead>
                <tr class="bg-gris">
                    <th>EMOCIÓN</th>
                    <th>ESTADO</th>
                </tr>
            </thead>
            <tbody>
                ${Object.entries(survey.emociones || {})
                  .map(
                    ([emo, val]) => `
                    <tr>
                        <td class="bold uppercase">${emo}</td>
                        <td style="text-align:center;">${val ? "SÍ" : "NO"}</td>
                    </tr>
                `,
                  )
                  .join("")}
            </tbody>
        </table>

        <div style="margin-top: 30px;">
            <table class="tabla-final">
                <tr class="bg-gris">
                    <td colspan="2"><strong>RECOMENDACIÓN EMPRESA (1-7):</strong> ${survey.recomendacion || "—"}</td>
                </tr>
                <tr>
                    <td style="vertical-align: top; width: 50%;">
                        <div class="bold" style="color:#1a4479">DESTACA:</div>
                        <div>${survey.destacados || "Sin comentarios."}</div>
                    </td>
                    <td style="vertical-align: top; width: 50%;">
                        <div class="bold" style="color:#1a4479">PUNTOS A MEJORAR:</div>
                        <div>${survey.mejoras || "Sin comentarios."}</div>
                    </td>
                </tr>
            </table>
        </div>
    </body>
    </html>
    `;

    // 3. GENERAR EL PDF CON PUPPETEER
    const browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || null,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
    });

    await browser.close();

    res.contentType("application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Expediente_${rut}.pdf`,
    );
    res.send(pdfBuffer);
  } catch (error) {
    console.error("Error al generar PDF:", error);
    res.status(500).json({ error: "No se pudo generar el PDF" });
  }
});

app.get("/api/admin/survey-by-rut/:rut", verifyToken, async (req, res) => {
  const { rut } = req.params;

  try {
    const user = await prisma.user.findUnique({
      where: { rut: rut },
      include: {
        survey: true, // Incluimos la encuesta asociada
      },
    });

    if (!user || !user.survey) {
      return res
        .status(404)
        .json({ message: "No se encontró encuesta para este RUT" });
    }

    // Devolvemos el usuario y su encuesta
    res.json({
      nombre: user.nombre || "Trabajador",
      rut: user.rut,
      survey: user.survey,
    });
  } catch (error) {
    console.error("Error al buscar por RUT:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/admin/detalle-emocion", verifyToken, async (req, res) => {
  try {
    // Recibimos page (página actual) y limit (registros por página)
    const { turno, emocion, page = 1, limit = 10 } = req.query;

    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const skip = (pageInt - 1) * limitInt;

    if (!turno || !emocion) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }

    // 1. Buscamos todas las encuestas completadas de ese turno
    const encuestas = await prisma.survey.findMany({
      where: {
        status: "COMPLETED",
        turno: turno,
      },
      include: {
        user: { select: { rut: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // 2. Filtramos en memoria las que tienen la emoción marcada como true
    const filtrados = encuestas.filter((e) => {
      return e.emociones && e.emociones[emocion] === true;
    });

    // 3. Calculamos el total antes de recortar el array
    const total = filtrados.length;

    // 4. Aplicamos el recorte (paginación) manualmente al array
    const paginados = filtrados.slice(skip, skip + limitInt);

    // 5. Formateamos la respuesta
    const data = paginados.map((e) => ({
      rut: e.user?.rut || "N/A",
      nombre: e.user?.nombre || "Anónimo",
      rec: e.recomendacion,
      fecha: new Date(e.createdAt).toLocaleDateString(),
    }));

    // Enviamos la data junto con los metadatos de paginación
    res.json({
      data,
      total,
      page: pageInt,
      limit: limitInt,
    });
  } catch (error) {
    console.error("Error en detalle-emocion:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

app.get("/api/admin/alertas-full", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Definimos la condición de filtrado una sola vez para evitar errores
    const whereCondition = {
      status: "COMPLETED",
      recomendacion: { lte: 4 }, // Bajamos de 5 a 4 para coincidir
      OR: [
        { emociones: { path: ["Estrés"], equals: true } },
        { emociones: { path: ["Frustración"], equals: true } },
      ],
    };

    // 1. Obtener el total de alertas filtradas
    const total = await prisma.survey.count({
      where: whereCondition,
    });

    // 2. Obtener los datos paginados
    const rows = await prisma.survey.findMany({
      where: whereCondition,
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      skip: skip,
      include: {
        user: {
          select: { rut: true },
        },
      },
    });

    // 3. Formatear la respuesta
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
      where: {
        status: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { rut: true } } },
    });

    if (encuestas.length === 0)
      return res.json({ error: "No hay datos finalizados aún" });

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

    // --- TURNOS ACTUALIZADOS ---
    const turnosData = {
      "G1 DIA": { suma: 0, count: 0, emociones: {} },
      "G2 NOCHE": { suma: 0, count: 0, emociones: {} },
      "G3 DIA": { suma: 0, count: 0, emociones: {} },
      "G4 NOCHE": { suma: 0, count: 0, emociones: {} },
      "TURNO 5 X 2": { suma: 0, count: 0, emociones: {} }, // Nuevo
      "TURNO 4 X 3": { suma: 0, count: 0, emociones: {} }, // Nuevo
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

      // Métrica 5 y 6: Emociones y Estrés (Funciona para cualquier turno en turnosData)
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

      // Métrica 7: Jefe Directo
      if (e.jefeDirecto) {
        if (!jefes[e.jefeDirecto]) jefes[e.jefeDirecto] = { suma: 0, count: 0 };
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

    // Cálculo de promedios para Métrica 4 (Brecha Día vs Noche)
    // Nota: Los nuevos turnos no se incluyen aquí a menos que definas si son día o noche.
    const promDia =
      (turnosData["G1 DIA"].suma + turnosData["G3 DIA"].suma) /
      (turnosData["G1 DIA"].count + turnosData["G3 DIA"].count || 1);
    const promNoche =
      (turnosData["G2 NOCHE"].suma + turnosData["G4 NOCHE"].suma) /
      (turnosData["G2 NOCHE"].count + turnosData["G4 NOCHE"].count || 1);

    // GRAFICOS GLOBALES
    // Calculamos los puntos totales por dimensión para las barras de la guía
    const puntosPorDimension = dimensiones.map((d) => {
      const sumaTotalRespuestasDim = encuestas.reduce((acc, e) => {
        // Sumamos los valores de las respuestas de esta dimensión específica
        const valores = Object.values(e.respuestas?.[d] || {});
        return acc + valores.reduce((a, b) => a + b, 0);
      }, 0);

      // Retornamos el promedio de puntos (Escala 1 a 55)
      return {
        label: d.toUpperCase(),
        puntos:
          total > 0
            ? parseFloat((sumaTotalRespuestasDim / total).toFixed(1))
            : 0,
      };
    });

    // El Puntaje Global es la suma de los puntos de las 5 dimensiones (Máx 275)
    const puntajeGlobal = puntosPorDimension.reduce(
      (acc, curr) => acc + curr.puntos,
      0,
    );
    //

    res.json({
      secciones: puntosPorDimension, // Para las 5 barras pequeñas
      puntajeGlobal: parseFloat(puntajeGlobal.toFixed(1)), // Para la barra grande
      nps: (
        encuestas.reduce((a, b) => a + (b.recomendacion || 0), 0) / total
      ).toFixed(1),
      distribucion: Object.entries(distribucion).map(([label, value]) => ({
        label,
        value,
      })),
      radar: dimensiones.map((d) =>
        radarCounts[d] > 0 ? (resumenRadar[d] / radarCounts[d]).toFixed(2) : 0,
      ),
      brecha: {
        dia: promDia.toFixed(1),
        noche: promNoche.toFixed(1),
        diff: Math.abs(promDia - promNoche).toFixed(1),
      },
      statsTurnos: Object.keys(turnosData).map((t) => ({
        nombre: t,
        emociones: turnosData[t].emociones,
        promedio:
          turnosData[t].count > 0
            ? (turnosData[t].suma / turnosData[t].count).toFixed(1)
            : 0,
      })),
      tasaEstres: ((conteoEstres / total) * 100).toFixed(1),
      rankingJefes: Object.entries(jefes)
        .map(([name, d]) => ({
          name: name,
          avg: (d.suma / d.count).toFixed(1),
        }))
        .sort((a, b) => b.avg - a.avg),
      alertasCount: alertas.length,
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
        .slice(0, 3),
      fidelizacion:
        radarCounts["empresa"] > 0
          ? ((resumenRadar["empresa"] / radarCounts["empresa"]) * 20).toFixed(1)
          : 0,
      seguridad: (sumaSeguridad / (radarCounts["condiciones"] || 1)).toFixed(1),
      cobertura: Object.entries(turnosData).map(([name, d]) => ({
        name,
        count: d.count,
      })),
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
