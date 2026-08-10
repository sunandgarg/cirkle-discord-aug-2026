export interface IITInfo {
  slug: string;
  name: string;
  abbreviation: string;
  city: string;
  state: string;
  foundedYear: number;
  nirfRank2025?: number;
  departments: string[];
  notableAlumni: string[];
  forumCategories: string[];
}

export const IIT_FORUM_CATEGORIES = [
  "General / Campus Life",
  "Academics & Courses",
  "Placements & Internships",
  "Research & Projects",
  "Alumni Connect",
  "Hostel & Housing",
  "Sports & Clubs",
  "Study Material & Resources",
  "Off Campus / City Life",
  "GATE / Higher Studies",
  "Entrepreneurship & Startups",
];

export const IIT_LIST: IITInfo[] = [
  { slug: "iit-bombay", name: "IIT Bombay", abbreviation: "IITB", city: "Mumbai", state: "Maharashtra", foundedYear: 1958, nirfRank2025: 3, departments: ["CS", "EE", "ME", "CE", "CH", "AE", "EP", "MM", "BS"], notableAlumni: ["Nandan Nilekani", "Raghuram Rajan"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-delhi", name: "IIT Delhi", abbreviation: "IITD", city: "New Delhi", state: "Delhi", foundedYear: 1961, nirfRank2025: 2, departments: ["CS", "EE", "ME", "CE", "CH", "TT", "MS", "BB"], notableAlumni: ["Rajeev Suri", "Vinod Gupta"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-madras", name: "IIT Madras", abbreviation: "IITM", city: "Chennai", state: "Tamil Nadu", foundedYear: 1959, nirfRank2025: 1, departments: ["CS", "EE", "ME", "CE", "CH", "AE", "NA", "ED"], notableAlumni: ["Sundar Pichai (honorary)", "Kris Gopalakrishnan"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-kanpur", name: "IIT Kanpur", abbreviation: "IITK", city: "Kanpur", state: "Uttar Pradesh", foundedYear: 1959, nirfRank2025: 4, departments: ["CS", "EE", "ME", "CE", "CH", "AE", "MSE", "PHY"], notableAlumni: ["NR Narayana Murthy", "Manindra Agrawal"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-kharagpur", name: "IIT Kharagpur", abbreviation: "IITKgp", city: "Kharagpur", state: "West Bengal", foundedYear: 1951, nirfRank2025: 5, departments: ["CS", "EE", "ME", "CE", "CH", "AE", "AG", "AR", "BT", "CY"], notableAlumni: ["Sundar Pichai", "Arvind Krishna"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-roorkee", name: "IIT Roorkee", abbreviation: "IITR", city: "Roorkee", state: "Uttarakhand", foundedYear: 1847, nirfRank2025: 6, departments: ["CS", "EE", "ME", "CE", "CH", "AR", "ES", "HY"], notableAlumni: ["Ajit Gulabchand"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-guwahati", name: "IIT Guwahati", abbreviation: "IITG", city: "Guwahati", state: "Assam", foundedYear: 1994, nirfRank2025: 7, departments: ["CS", "EE", "ME", "CE", "CH", "BT", "DS", "PHY"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-hyderabad", name: "IIT Hyderabad", abbreviation: "IITH", city: "Hyderabad", state: "Telangana", foundedYear: 2008, nirfRank2025: 8, departments: ["CS", "EE", "ME", "CE", "CH", "BT", "AI", "MSE"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-bhu", name: "IIT (BHU) Varanasi", abbreviation: "IITBHU", city: "Varanasi", state: "Uttar Pradesh", foundedYear: 1919, nirfRank2025: 10, departments: ["CS", "EE", "ME", "CE", "CH", "MN", "CR", "PH"], notableAlumni: ["Lal Bahadur Shastri"], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-indore", name: "IIT Indore", abbreviation: "IITI", city: "Indore", state: "Madhya Pradesh", foundedYear: 2009, nirfRank2025: 11, departments: ["CS", "EE", "ME", "CE", "HSS", "PHY", "MATHS"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-mandi", name: "IIT Mandi", abbreviation: "IITMandi", city: "Mandi", state: "Himachal Pradesh", foundedYear: 2009, departments: ["CS", "EE", "ME", "CE", "BT", "HSS"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-patna", name: "IIT Patna", abbreviation: "IITP", city: "Patna", state: "Bihar", foundedYear: 2008, departments: ["CS", "EE", "ME", "CE", "CH", "PHY"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-ropar", name: "IIT Ropar", abbreviation: "IITRopar", city: "Rupnagar", state: "Punjab", foundedYear: 2008, departments: ["CS", "EE", "ME", "CE", "CH", "BM", "MATHS"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-jodhpur", name: "IIT Jodhpur", abbreviation: "IITJ", city: "Jodhpur", state: "Rajasthan", foundedYear: 2008, departments: ["CS", "EE", "ME", "CE", "BT", "PHY", "MATHS"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-gandhinagar", name: "IIT Gandhinagar", abbreviation: "IITGN", city: "Gandhinagar", state: "Gujarat", foundedYear: 2008, departments: ["CS", "EE", "ME", "CE", "CH", "CG", "ES", "HSS"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-tirupati", name: "IIT Tirupati", abbreviation: "IITTP", city: "Tirupati", state: "Andhra Pradesh", foundedYear: 2015, departments: ["CS", "EE", "ME", "CE", "CH"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-palakkad", name: "IIT Palakkad", abbreviation: "IITPKD", city: "Palakkad", state: "Kerala", foundedYear: 2015, departments: ["CS", "EE", "ME", "CE", "DS"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-jammu", name: "IIT Jammu", abbreviation: "IITJammu", city: "Jammu", state: "Jammu & Kashmir", foundedYear: 2016, departments: ["CS", "EE", "ME", "CE", "CH"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-dharwad", name: "IIT Dharwad", abbreviation: "IITDh", city: "Dharwad", state: "Karnataka", foundedYear: 2016, departments: ["CS", "EE", "ME", "MATHS", "PHY"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-bhilai", name: "IIT Bhilai", abbreviation: "IITBhilai", city: "Bhilai", state: "Chhattisgarh", foundedYear: 2016, departments: ["CS", "EE", "ME", "MATHS", "PHY", "CH"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-goa", name: "IIT Goa", abbreviation: "IITGoa", city: "Ponda", state: "Goa", foundedYear: 2016, departments: ["CS", "EE", "ME", "MATHS", "PHY"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-dhanbad", name: "IIT (ISM) Dhanbad", abbreviation: "IITISM", city: "Dhanbad", state: "Jharkhand", foundedYear: 1926, nirfRank2025: 9, departments: ["CS", "EE", "ME", "CE", "CH", "MN", "PE", "FME", "ES"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
  { slug: "iit-ism-dhanbad", name: "IIT (ISM) Dhanbad", abbreviation: "IITISM", city: "Dhanbad", state: "Jharkhand", foundedYear: 1926, departments: ["CS", "EE", "ME", "MN"], notableAlumni: [], forumCategories: IIT_FORUM_CATEGORIES },
];

// Deduplicated list (iit-dhanbad and iit-ism-dhanbad point to same)
export const IIT_SLUGS = IIT_LIST.map(i => i.slug);

export const getIITBySlug = (slug: string): IITInfo | undefined =>
  IIT_LIST.find(i => i.slug === slug);

export const getIITByName = (name: string): IITInfo | undefined =>
  IIT_LIST.find(i => i.name === name || i.abbreviation === name);
