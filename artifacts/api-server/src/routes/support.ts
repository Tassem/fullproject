import { Router } from "express";
import { db, supportTicketsTable, ticketMessagesTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// ── USER ROUTES ──────────────────────────────────────────────────────────────

// List user tickets
router.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const isAdmin = (req as any).user.isAdmin;
  
  let tickets;
  if (isAdmin) {
    tickets = await db.select({
      id: supportTicketsTable.id,
      userId: supportTicketsTable.userId,
      subject: supportTicketsTable.subject,
      status: supportTicketsTable.status,
      priority: supportTicketsTable.priority,
      category: supportTicketsTable.category,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      userName: usersTable.name,
      userEmail: usersTable.email,
    })
    .from(supportTicketsTable)
    .innerJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .orderBy(desc(supportTicketsTable.updatedAt));
  } else {
    tickets = await db.select().from(supportTicketsTable)
      .where(eq(supportTicketsTable.userId, userId))
      .orderBy(desc(supportTicketsTable.updatedAt));
  }
  return res.json(tickets);
});

// Create new ticket
router.post("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const { subject, category, priority, message } = req.body;

  if (!subject || !message) {
    return res.status(400).json({ error: "Subject and message are required" });
  }

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId,
    subject,
    category: category || "general",
    priority: priority || "medium",
    status: "open",
  }).returning();

  await db.insert(ticketMessagesTable).values({
    ticketId: ticket.id,
    senderId: userId,
    message,
    isAdmin: false,
  });

  return res.json(ticket);
});

// Get ticket details & messages
router.get("/:id", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const isAdmin = (req as any).user.isAdmin;
  const ticketId = parseInt(req.params.id, 10);

  const [ticket] = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, ticketId))
    .limit(1);

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  
  // Security check: only owner or admin can view
  if (ticket.userId !== userId && !isAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const messages = await db.select().from(ticketMessagesTable)
    .where(eq(ticketMessagesTable.ticketId, ticketId))
    .orderBy(desc(ticketMessagesTable.createdAt));

  return res.json({ ticket, messages });
});

// Reply to ticket
router.post("/:id/messages", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const isAdmin = (req as any).user.isAdmin;
  const ticketId = parseInt(req.params.id, 10);
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });

  const [ticket] = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, ticketId))
    .limit(1);

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (ticket.userId !== userId && !isAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  const [newMessage] = await db.insert(ticketMessagesTable).values({
    ticketId,
    senderId: userId,
    message,
    isAdmin: isAdmin === true,
  }).returning();

  // Update ticket timestamp & status if admin replied
  await db.update(supportTicketsTable).set({
    updatedAt: new Date(),
    status: isAdmin ? "in_progress" : "open",
  }).where(eq(supportTicketsTable.id, ticketId));

  return res.json(newMessage);
});

// Close ticket
router.post("/:id/close", requireAuth, async (req, res) => {
  const userId = (req as any).user.id;
  const isAdmin = (req as any).user.isAdmin;
  const ticketId = parseInt(req.params.id, 10);

  const [ticket] = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, ticketId))
    .limit(1);

  if (!ticket) return res.status(404).json({ error: "Ticket not found" });
  if (ticket.userId !== userId && !isAdmin) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  await db.update(supportTicketsTable).set({
    status: "closed",
    updatedAt: new Date(),
  }).where(eq(supportTicketsTable.id, ticketId));

  return res.json({ success: true });
});

export default router;
