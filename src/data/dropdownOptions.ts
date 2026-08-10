export const degrees: string[] = [
  "BTech", "MTech", "BE", "ME", "MBA", "PGDM", "BBA", "MCA", "BCA",
  "BSc", "MSc", "BA", "MA", "BCom", "MCom", "PhD", "MPhil",
  "LLB", "LLM", "MBBS", "MD", "BDes", "MDes", "BArch", "MArch",
  "BEd", "MEd", "BPharm", "MPharm", "Diploma", "Certificate",
];

export const branches: string[] = [
  "CSE", "IT", "ECE", "EEE", "Mechanical", "Civil", "Chemical",
  "Aerospace", "Biotechnology", "Mathematics & Computing",
  "Engineering Physics", "Metallurgical", "Mining", "Industrial",
  "Instrumentation", "Production", "Textile", "Naval Architecture",
  "Environmental", "Agricultural",
  "Finance", "Marketing", "HR", "Operations", "Economics",
  "Data Science", "AI/ML", "Management", "Strategy", "Consulting",
  "Psychology", "Sociology", "History", "Political Science",
  "Physics", "Chemistry", "Biology", "Mathematics",
  "Law", "Design", "Architecture", "Media & Communication",
  "Public Policy", "International Relations",
];

export const expertiseCategories: string[] = [
  "Software Development", "Product Management", "Marketing", "Finance",
  "Consulting", "AI/ML", "Data Analytics", "Entrepreneurship",
  "Sales", "Operations", "Strategy", "UI/UX Design",
  "Cybersecurity", "Blockchain", "Cloud Computing", "DevOps",
  "Research", "Content Creation", "Investment Banking", "Venture Capital",
  "Human Resources", "Legal", "Public Policy", "Supply Chain",
  "EdTech", "Healthcare Tech", "Sustainability", "Social Impact",
  "Business Development", "Growth Hacking",
];

export const passingYears: string[] = Array.from(
  { length: 2035 - 1980 + 1 },
  (_, i) => String(2035 - i)
);
