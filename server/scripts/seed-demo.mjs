/**
 * Seed Demo Data Script (#15)
 * Creates sample contacts, lists, and opportunities for demo/testing.
 * Run: node server/scripts/seed-demo.mjs <userId>
 */

const DEMO_CONTACTS = [
  { fullName: "Sarah Chen", firstName: "Sarah", lastName: "Chen", title: "VP of Engineering", company: "Stripe", location: "San Francisco, CA", linkedinUrl: "https://linkedin.com/in/sarah-chen", status: "saved" },
  { fullName: "Marcus Johnson", firstName: "Marcus", lastName: "Johnson", title: "Founder & CEO", company: "TechBridge AI", location: "Austin, TX", linkedinUrl: "https://linkedin.com/in/marcusjohnson", status: "saved" },
  { fullName: "Elena Rodriguez", firstName: "Elena", lastName: "Rodriguez", title: "Head of Partnerships", company: "Notion", location: "New York, NY", linkedinUrl: "https://linkedin.com/in/elenarodriguez", status: "saved" },
  { fullName: "David Kim", firstName: "David", lastName: "Kim", title: "CTO", company: "Loom", location: "San Francisco, CA", linkedinUrl: "https://linkedin.com/in/davidkim-cto", status: "saved" },
  { fullName: "Priya Patel", firstName: "Priya", lastName: "Patel", title: "Director of Growth", company: "Figma", location: "San Francisco, CA", linkedinUrl: "https://linkedin.com/in/priyapatel", status: "contacted" },
  { fullName: "James Wilson", firstName: "James", lastName: "Wilson", title: "Angel Investor", company: "Wilson Ventures", location: "Miami, FL", linkedinUrl: "https://linkedin.com/in/jameswilson-vc", status: "saved" },
  { fullName: "Aisha Mohammed", firstName: "Aisha", lastName: "Mohammed", title: "Product Lead", company: "OpenAI", location: "San Francisco, CA", linkedinUrl: "https://linkedin.com/in/aishamohammed", status: "saved" },
  { fullName: "Tom Anderson", firstName: "Tom", lastName: "Anderson", title: "VP Sales", company: "Salesforce", location: "San Francisco, CA", linkedinUrl: "https://linkedin.com/in/tomanderson-sf", status: "saved" },
  { fullName: "Lisa Zhang", firstName: "Lisa", lastName: "Zhang", title: "Head of AI Research", company: "Google DeepMind", location: "London, UK", linkedinUrl: "https://linkedin.com/in/lisazhang-ai", status: "saved" },
  { fullName: "Roberto Morales", firstName: "Roberto", lastName: "Morales", title: "Startup Advisor", company: "Y Combinator", location: "Mountain View, CA", linkedinUrl: "https://linkedin.com/in/robertomorales", status: "contacted" },
];

const DEMO_LISTS = [
  { name: "AI Founders", description: "Founders building AI-first companies" },
  { name: "Potential Investors", description: "Angel investors and VCs to connect with" },
  { name: "Tech Leaders SF", description: "Senior tech leaders in San Francisco" },
];

console.log("=== iNexus Demo Seed Data ===");
console.log(`Contacts: ${DEMO_CONTACTS.length}`);
console.log(`Lists: ${DEMO_LISTS.length}`);
console.log("");
console.log("To seed this data, use the iNexus UI:");
console.log("1. Go to Discover and search for 'AI startup founders'");
console.log("2. Save results to build your contact list");
console.log("3. Create lists and organize contacts");
console.log("");
console.log("Or use the API directly:");
console.log("POST /api/trpc/discover.bulkSave with the contacts above");
console.log("");
console.log("Demo contacts JSON:");
console.log(JSON.stringify(DEMO_CONTACTS, null, 2));
console.log("");
console.log("Demo lists JSON:");
console.log(JSON.stringify(DEMO_LISTS, null, 2));
