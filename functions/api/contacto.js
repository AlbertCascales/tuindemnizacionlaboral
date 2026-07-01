function sanitize(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function escapeForBody(value) {
  return String(value || "").trim();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let formData;
  try {
    formData = await request.formData();
  } catch (e) {
    return new Response("Solicitud inválida.", { status: 400 });
  }

  const nombre = sanitize(formData.get("nombre"));
  const telefono = sanitize(formData.get("telefono"));
  const email = sanitize(formData.get("email"));
  const tipo = sanitize(formData.get("tipo_de_caso"));
  const mensaje = escapeForBody(formData.get("mensaje"));

  if (!nombre || !telefono || !email || !mensaje) {
    return new Response("Faltan campos obligatorios.", { status: 400 });
  }

  const bodyLines = [
    `Nombre: ${nombre}`,
    `Telefono: ${telefono}`,
    `Email: ${email}`,
    `Tipo de caso: ${tipo || "No especificado"}`,
    "",
    "Mensaje:",
    mensaje,
  ].join("\r\n");

  const raw = [
    "From: Formulario Web <formulario@tuindemnizacionlaboral.com>",
    "To: consultas@tuindemnizacionlaboral.com",
    `Reply-To: ${email}`,
    "Subject: Nueva consulta desde tuindemnizacionlaboral.com",
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    bodyLines,
  ].join("\r\n");

  try {
    const { EmailMessage } = await import("cloudflare:email");
    const message = new EmailMessage(
      "formulario@tuindemnizacionlaboral.com",
      "consultas@tuindemnizacionlaboral.com",
      raw
    );
    await env.SEB.send(message);
  } catch (err) {
    return new Response("No se pudo enviar el mensaje: " + err.message, { status: 500 });
  }

  return Response.redirect(new URL("/contacto/?enviado=1", request.url), 303);
}
