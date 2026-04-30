import React from "react";
import { 
  BookOpen, 
  Image as ImageIcon, 
  Rss, 
  Layout, 
  CreditCard, 
  Sparkles, 
  MessageSquare, 
  LifeBuoy, 
  Code, 
  ShieldCheck,
  ChevronDown
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

const categories = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: BookOpen,
    items: [
      { q: "What is MediaFlow?", a: "A comprehensive platform that combines news card generation and AI-powered blog automation." },
      { q: "How do I start?", a: "Sign up, choose a suitable plan, and start creating your first news card or connect your WordPress site." }
    ]
  },
  {
    id: "designer",
    title: "Card Designer",
    icon: ImageIcon,
    items: [
      { q: "How do I use the Template Builder?", a: "You can drag and drop elements, change colors, and add your own logo to create a unique template." },
      { q: "What image sizes are supported?", a: "We support 1:1, 16:9, and 9:16 aspect ratios to fit all social media platforms." }
    ]
  },
  {
    id: "automation",
    title: "Blog Automation",
    icon: Rss,
    items: [
      { q: "How does the automation system work?", a: "The system monitors RSS feeds, scrapes content, analyzes it with AI, and then automatically publishes it to your site." },
      { q: "Is the content SEO-friendly?", a: "Yes, the system generates entirely new content optimized for keywords and internal linking." }
    ]
  },
  {
    id: "wordpress",
    title: "WordPress Integration",
    icon: Layout,
    items: [
      { q: "How do I connect my site?", a: "Go to the Sites page, add your site URL, username, and an Application Password." },
      { q: "Why does the connection sometimes fail?", a: "Ensure that REST API is enabled on your site and no security plugins are blocking external requests." }
    ]
  },
  {
    id: "billing",
    title: "Credits & Subscriptions",
    icon: CreditCard,
    items: [
      { q: "What is the difference between Monthly and Purchased credits?", a: "Monthly credits renew every month with your plan, while Purchased credits never expire and are used after monthly credits are exhausted." },
      { q: "How can I upgrade?", a: "From the Subscription page, choose the plan that suits you and send the payment request." }
    ]
  },
  {
    id: "ai-image",
    title: "AI Image Generation",
    icon: Sparkles,
    items: [
      { q: "How do I get AI-generated images?", a: "You must purchase the AI Image Generation addon from the addons page to enable it in the designer and pipeline." },
      { q: "What is the cost per image?", a: "The cost depends on settings; the default is 3 points per AI-generated image." }
    ]
  },
  {
    id: "bot",
    title: "Telegram Bot",
    icon: MessageSquare,
    items: [
      { q: "How do I use the Telegram bot?", a: "Link your account with the bot using your unique code, then send news text to the bot to generate a card instantly." },
      { q: "Does the bot support all templates?", a: "The bot supports templates enabled in your account that have been marked as quick templates." }
    ]
  },
  {
    id: "support",
    title: "Support System",
    icon: LifeBuoy,
    items: [
      { q: "How do I open a support ticket?", a: "From the Tickets page, create a new ticket and explain your issue in detail. Our team will respond as soon as possible." },
      { q: "What are the response times?", a: "We try to respond to all tickets in less than 24 hours, with priority for Pro and Business plans." }
    ]
  },
  {
    id: "api",
    title: "API (Developers)",
    icon: Code,
    items: [
      { q: "Where do I find my API key?", a: "You can get your API key from the Settings page to use in your own applications." },
      { q: "Is there API documentation?", a: "Yes, you can review the built-in Swagger documentation to see all available endpoints." }
    ]
  },
  {
    id: "terms",
    title: "Terms & Policy",
    icon: ShieldCheck,
    items: [
      { q: "Is my data secure?", a: "We are committed to the highest security standards and do not share your data or site content with any third party." },
      { q: "What is the refund policy?", a: "You can request a refund within 24 hours of subscription if no credits have been consumed." }
    ]
  }
];

export default function Help() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="flex flex-col gap-2 mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-primary">Help Center</h1>
        <p className="text-muted-foreground text-lg">
          Everything you need to know about using MediaFlow
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {categories.map((cat) => (
          <Card key={cat.id} className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <cat.icon className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl">{cat.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {cat.items.map((item, idx) => (
                  <AccordionItem key={idx} value={`item-${idx}`} className="border-b-0">
                    <AccordionTrigger className="text-left hover:no-underline hover:text-primary py-3">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 p-6 rounded-2xl bg-primary/5 border border-primary/10 text-center">
        <h3 className="text-lg font-semibold mb-2">Didn't find what you're looking for?</h3>
        <p className="text-muted-foreground mb-4">Our support team is always available to help you.</p>
        <button 
          className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-medium hover:opacity-90 transition-opacity"
          onClick={() => window.location.href = '/tickets'}
        >
          Contact Us Now
        </button>
      </div>
    </div>
  );
}
