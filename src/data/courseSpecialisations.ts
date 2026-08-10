// Course → Specialisation mapping from IIT official data
// Used in onboarding wizard and profile editing

export const COURSE_SPECIALISATIONS: Record<string, string[]> = {
  BTech: [
    "General", "Computer Science & Engineering", "Artificial Intelligence", "Data Science",
    "Electrical Engineering", "Electronics & Communication Engineering", "Mechanical Engineering",
    "Civil Engineering", "Chemical Engineering", "Metallurgical Engineering", "Materials Science",
    "Mathematics & Computing", "Engineering Physics", "Aerospace Engineering", "Naval Architecture",
    "Ocean Engineering", "Mining Engineering", "Petroleum Engineering", "Industrial Engineering",
    "Production Engineering", "Manufacturing Engineering", "Mechatronics", "Instrumentation Engineering",
    "Biomedical Engineering", "Biotechnology", "Agricultural Engineering", "Food Engineering",
    "Textile Engineering", "Fibre Engineering", "Paper & Pulp Engineering", "Polymer Engineering",
    "Ceramic Engineering", "Pharmaceutical Engineering", "Environmental Engineering", "Water Resources",
    "Transportation Engineering", "Structural Engineering", "Geotechnical Engineering",
    "Exploration Geophysics", "Geological Technology", "Space Science", "Computational Engineering",
    "Sustainable Engineering", "Design",
  ],
  "Dual Degree": [
    "General", "Computer Science", "Electrical Engineering", "Electronics Engineering",
    "Mechanical Engineering", "Civil Engineering", "Chemical Engineering", "Materials Engineering",
    "Aerospace Engineering", "Bioengineering", "Mining Engineering", "Engineering Design",
    "Management", "Data Science", "Mathematics", "Physics", "Geophysics",
  ],
  MTech: [
    "General", "Artificial Intelligence", "Machine Learning", "Data Science", "Computer Systems",
    "Computer Networks", "Cybersecurity", "Software Engineering", "Human Computer Interaction",
    "Computer Vision", "VLSI", "Embedded Systems", "Signal Processing", "Communications",
    "Power Systems", "Power Electronics", "Control Systems", "Renewable Energy", "Electric Vehicles",
    "Thermal Engineering", "Design Engineering", "Advanced Manufacturing", "Robotics", "Dynamics",
    "Structural Engineering", "Geotechnical Engineering", "Transportation Engineering",
    "Water Resources", "Environmental Engineering", "Construction Management", "Rock Engineering",
    "Geomatics", "Remote Sensing", "Process Engineering", "Reaction Engineering",
    "Bioprocess Engineering", "Polymer Technology", "Petroleum Engineering",
    "Pharmaceutical Engineering", "Materials Science", "Nanotechnology", "Biomaterials",
    "Corrosion Engineering", "Ceramic Engineering", "Metallurgical Engineering",
    "Aerospace Engineering", "Ocean Engineering", "Mining Engineering", "Exploration Geophysics",
    "Biotechnology", "Bioinformatics", "Medical Imaging", "Food Technology", "Textile Engineering",
    "Industrial Engineering", "Operations Research", "Computational Science", "Climate Science",
    "Energy Systems", "Smart Infrastructure",
  ],
  MS: [
    "General", "Artificial Intelligence", "Data Science", "Computer Systems", "Cybersecurity",
    "VLSI", "Signal Processing", "Power Systems", "Robotics", "Manufacturing", "Thermal Sciences",
    "Structural Engineering", "Geotechnical Engineering", "Environmental Engineering",
    "Chemical Engineering", "Bioprocess Engineering", "Materials Science", "Nanomaterials",
    "Earth Sciences", "Physics", "Chemistry", "Mathematics", "Cognitive Science",
    "Computational Social Science",
  ],
  MSc: [
    "General", "Mathematics", "Physics", "Chemistry", "Statistics", "Data Science",
    "Earth Sciences", "Geology", "Geophysics", "Biological Sciences", "Biotechnology",
    "Environmental Science", "Astronomy", "Materials Science", "Economics",
  ],
  BS: [
    "General", "Artificial Intelligence", "Data Science", "Mathematics", "Physics",
    "Chemistry", "Earth Sciences", "Computational Science", "Management",
  ],
  BDes: [
    "General", "Product Design", "Interaction Design", "Communication Design", "Visual Design",
    "Industrial Design", "Service Design", "Strategic Design", "Sustainability Design",
    "Interior Design",
  ],
  MDes: [
    "General", "Product Design", "Interaction Design", "Experience Design", "Service Design",
    "Strategic Design", "Sustainability Design", "Design Innovation", "Computational Design",
    "Digital Fabrication", "XR Design",
  ],
  MBA: [
    "General", "Finance", "Marketing", "Operations", "Supply Chain Management", "Human Resources",
    "Strategy", "Entrepreneurship", "Business Analytics", "Information Systems",
    "Technology Management", "Innovation Management", "Sustainability", "Healthcare Management",
    "Project Management",
  ],
  MA: [
    "General", "English", "Linguistics", "Development Studies", "Philosophy", "Public Policy",
    "Digital Humanities", "Media Studies", "Economics", "Psychology",
  ],
  PhD: [
    "General", "Artificial Intelligence", "Machine Learning", "Data Science", "Computer Vision",
    "Cybersecurity", "Algorithms", "Distributed Systems", "VLSI", "Embedded Systems",
    "Signal Processing", "Communications", "Power Systems", "Renewable Energy", "Robotics",
    "Thermal Sciences", "Manufacturing", "Structural Engineering", "Geotechnical Engineering",
    "Transportation Engineering", "Water Resources", "Environmental Engineering",
    "Chemical Engineering", "Bioprocess Engineering", "Biomedical Engineering", "Bioinformatics",
    "Materials Science", "Nanotechnology", "Metallurgical Engineering", "Polymer Science",
    "Physics", "Quantum Physics", "Photonics", "Chemistry", "Mathematics", "Statistics",
    "Operations Research", "Climate Science", "Earth Sciences", "Geophysics", "Mining Engineering",
    "Petroleum Engineering", "Aerospace Engineering", "Ocean Engineering", "Cognitive Science",
    "Neuroscience", "Heritage Science", "Computational Social Science", "Economics", "Finance",
    "Management", "Entrepreneurship", "Public Policy", "Sustainability", "Urban Systems",
    "Quantum Computing", "Blockchain", "Smart Cities",
  ],
  MPhil: [
    "General", "Development Studies", "English", "Philosophy", "Psychology",
    "Social Sciences", "Applied Sciences",
  ],
};

export const ALL_COURSES = Object.keys(COURSE_SPECIALISATIONS);

export const getSpecialisations = (course: string): string[] => {
  return COURSE_SPECIALISATIONS[course] || [];
};
