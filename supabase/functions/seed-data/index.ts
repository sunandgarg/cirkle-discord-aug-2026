import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Create 20 test users with profiles
    const testUsers = [
      { phone: "9876543201", name: "Aarav Sharma", iit: "IIT Delhi", status: "2024 BTech Computer Science", headline: "SDE @ Google | IIT Delhi '24", bio: "Full-stack developer passionate about AI/ML. Building cool stuff.", location: "New Delhi", skills: ["React", "Python", "Machine Learning", "TypeScript", "Node.js"], is_mentor: true, mentor_category: "Tech", mentor_price_chat: 200, mentor_price_audio: 400, mentor_price_video: 600 },
      { phone: "9876543202", name: "Priya Patel", iit: "IIT Bombay", status: "2023 BTech Electrical", headline: "Product Manager @ Microsoft", bio: "PM at Microsoft, ex-Goldman Sachs. Love building products that matter.", location: "Mumbai", skills: ["Product Management", "SQL", "Data Analytics", "Leadership", "Agile"], is_mentor: true, mentor_category: "Career", mentor_price_chat: 300, mentor_price_audio: 500, mentor_price_video: 800 },
      { phone: "9876543203", name: "Rahul Gupta", iit: "IIT Madras", status: "2025 MTech Data Science", headline: "ML Research @ DeepMind", bio: "Research engineer working on large language models and computer vision.", location: "Chennai", skills: ["Deep Learning", "PyTorch", "NLP", "Computer Vision", "Research"], is_mentor: true, mentor_category: "Research", mentor_price_chat: 250, mentor_price_audio: 450, mentor_price_video: 700 },
      { phone: "9876543204", name: "Sneha Reddy", iit: "IIT Hyderabad", status: "2024 BTech Computer Science", headline: "Frontend Lead @ Flipkart", bio: "Building beautiful, accessible UIs. Open source contributor.", location: "Hyderabad", skills: ["React", "TypeScript", "CSS", "Figma", "Design Systems"], is_mentor: false },
      { phone: "9876543205", name: "Vikram Singh", iit: "IIT Kanpur", status: "2022 BTech Mechanical", headline: "Founder & CEO @ BuildRight", bio: "Serial entrepreneur. 2x startup founder. Building the future of construction tech.", location: "Bangalore", skills: ["Entrepreneurship", "Strategy", "Fundraising", "Product", "Leadership"], is_mentor: true, mentor_category: "Startups", mentor_price_chat: 500, mentor_price_audio: 800, mentor_price_video: 1200 },
      { phone: "9876543206", name: "Ananya Joshi", iit: "IIT Delhi", status: "2024 BTech Computer Science", headline: "Data Scientist @ Amazon", bio: "Working on recommendation systems. Kaggle expert.", location: "Bangalore", skills: ["Python", "Machine Learning", "SQL", "Statistics", "Data Science"], is_mentor: true, mentor_category: "Tech", mentor_price_chat: 200, mentor_price_audio: 350, mentor_price_video: 550 },
      { phone: "9876543207", name: "Arjun Kumar", iit: "IIT Kharagpur", status: "2023 BTech Civil", headline: "Consultant @ McKinsey", bio: "Management consultant. Ex-ITC. Helping companies scale.", location: "Kolkata", skills: ["Consulting", "Strategy", "Finance", "Excel", "Presentation"], is_mentor: true, mentor_category: "Finance", mentor_price_chat: 400, mentor_price_audio: 700, mentor_price_video: 1000 },
      { phone: "9876543208", name: "Meera Nair", iit: "IIT Madras", status: "2024 MTech AI/ML", headline: "AI Engineer @ OpenAI", bio: "Working on next-gen AI systems. Published 5 papers in top conferences.", location: "San Francisco", skills: ["AI/ML", "Python", "TensorFlow", "Research", "LLMs"], is_mentor: true, mentor_category: "Research", mentor_price_chat: 600, mentor_price_audio: 1000, mentor_price_video: 1500 },
      { phone: "9876543209", name: "Karthik Iyer", iit: "IIT Bombay", status: "2025 BTech Computer Science", headline: "SWE Intern @ Meta", bio: "Competitive programmer. Codeforces Master. Love solving problems.", location: "Mumbai", skills: ["C++", "Competitive Programming", "Algorithms", "System Design", "Java"], is_mentor: false },
      { phone: "9876543210", name: "Divya Agarwal", iit: "IIT Roorkee", status: "2023 BTech Chemical", headline: "Investment Banking @ Goldman Sachs", bio: "IB analyst focused on tech sector M&A. CFA Level 2.", location: "Mumbai", skills: ["Finance", "Valuation", "Excel", "Financial Modeling", "M&A"], is_mentor: true, mentor_category: "Finance", mentor_price_chat: 350, mentor_price_audio: 600, mentor_price_video: 900 },
      { phone: "9876543211", name: "Rohan Mehta", iit: "IIT Guwahati", status: "2024 BTech ECE", headline: "VLSI Design Engineer @ Intel", bio: "Chip design enthusiast. Working on next-gen processor architectures.", location: "Bangalore", skills: ["VLSI", "Verilog", "Digital Design", "FPGA", "Signal Processing"], is_mentor: false },
      { phone: "9876543212", name: "Ishita Banerjee", iit: "IIT Delhi", status: "2025 MBA General Management", headline: "Strategy Lead @ Uber", bio: "MBA from IIT Delhi. Building mobility solutions for India.", location: "New Delhi", skills: ["Strategy", "Marketing", "Analytics", "Leadership", "Operations"], is_mentor: true, mentor_category: "Career", mentor_price_chat: 300, mentor_price_audio: 500, mentor_price_video: 800 },
      { phone: "9876543213", name: "Aditya Kapoor", iit: "IIT BHU", status: "2023 BTech Metallurgical", headline: "DevOps Engineer @ Netflix", bio: "Cloud infrastructure at scale. AWS certified. Kubernetes expert.", location: "Remote", skills: ["DevOps", "AWS", "Docker", "Kubernetes", "CI/CD"], is_mentor: true, mentor_category: "Tech", mentor_price_chat: 250, mentor_price_audio: 400, mentor_price_video: 650 },
      { phone: "9876543214", name: "Nisha Verma", iit: "IIT Indore", status: "2024 BTech Computer Science", headline: "UX Designer @ Airbnb", bio: "Designing delightful experiences. Previously at Swiggy.", location: "Bangalore", skills: ["UI/UX Design", "Figma", "User Research", "Prototyping", "Design Thinking"], is_mentor: true, mentor_category: "Design", mentor_price_chat: 200, mentor_price_audio: 350, mentor_price_video: 550 },
      { phone: "9876543215", name: "Siddharth Rao", iit: "IIT Kanpur", status: "2024 BTech Computer Science", headline: "Blockchain Developer @ Polygon", bio: "Web3 builder. Smart contract security researcher.", location: "Pune", skills: ["Blockchain", "Solidity", "Smart Contracts", "DeFi", "Web3"], is_mentor: false },
      { phone: "9876543216", name: "Kavya Sundaram", iit: "IIT Madras", status: "2025 PhD Physics", headline: "Quantum Computing Researcher", bio: "PhD candidate working on quantum error correction. Published in Nature.", location: "Chennai", skills: ["Quantum Computing", "Physics", "Python", "Research", "Mathematics"], is_mentor: true, mentor_category: "Research", mentor_price_chat: 300, mentor_price_audio: 500, mentor_price_video: 800 },
      { phone: "9876543217", name: "Nikhil Deshmukh", iit: "IIT Bombay", status: "2022 BTech Computer Science", headline: "Co-founder @ TechFlow AI", bio: "Building AI-powered workflow automation. YC S22.", location: "San Francisco", skills: ["Entrepreneurship", "AI/ML", "Product", "Fundraising", "Python"], is_mentor: true, mentor_category: "Startups", mentor_price_chat: 500, mentor_price_audio: 900, mentor_price_video: 1500 },
      { phone: "9876543218", name: "Riya Malhotra", iit: "IIT Delhi", status: "2024 BTech Computer Science", headline: "Backend Engineer @ Stripe", bio: "Building payment infrastructure. Distributed systems enthusiast.", location: "Bangalore", skills: ["Go", "Distributed Systems", "PostgreSQL", "System Design", "API Design"], is_mentor: false },
      { phone: "9876543219", name: "Harsh Vardhan", iit: "IIT Ropar", status: "2025 BTech ECE", headline: "IoT Engineer @ Bosch", bio: "Building connected devices for smart manufacturing.", location: "Chandigarh", skills: ["IoT", "Embedded Systems", "C", "Python", "Arduino"], is_mentor: false },
      { phone: "9876543220", name: "Tanvi Bhatt", iit: "IIT Gandhinagar", status: "2024 BTech Chemical", headline: "Sustainability Consultant @ EY", bio: "Helping companies achieve net-zero. Passionate about climate tech.", location: "Ahmedabad", skills: ["Sustainability", "ESG", "Data Analytics", "Consulting", "Climate Tech"], is_mentor: true, mentor_category: "Career", mentor_price_chat: 200, mentor_price_audio: 350, mentor_price_video: 550 },
    ];

    const createdUserIds: string[] = [];

    for (const u of testUsers) {
      const email = `${u.phone}@cirkle.world`;
      const password = `cirkle_${u.phone}_secure`;

      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name: u.name, phone: u.phone },
      });

      if (authError) {
        // User might already exist, try to get them
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users?.find((eu: any) => eu.email === email);
        if (existing) {
          createdUserIds.push(existing.id);
          continue;
        }
        console.error(`Failed to create user ${u.name}:`, authError.message);
        continue;
      }

      const userId = authUser.user.id;
      createdUserIds.push(userId);

      // Upsert profile
      await supabase.from("profiles").upsert({
        user_id: userId,
        name: u.name,
        iit_name: u.iit,
        student_status: u.status,
        headline: u.headline,
        bio: u.bio,
        location: u.location,
        skills: u.skills,
        is_verified: true,
        onboarding_completed: true,
        is_mentor: u.is_mentor || false,
        mentor_category: u.mentor_category || null,
        mentor_price_chat: u.mentor_price_chat || null,
        mentor_price_audio: u.mentor_price_audio || null,
        mentor_price_video: u.mentor_price_video || null,
        avatar_url: `https://i.pravatar.cc/150?u=${u.phone}`,
      }, { onConflict: "user_id" });

      // Add education
      await supabase.from("education").insert({
        user_id: userId,
        institution: u.iit,
        degree: u.status.split(" ")[1] || "BTech",
        branch_area: u.status.split(" ").slice(2).join(" ") || "General",
        passing_year: u.status.split(" ")[0] || "2024",
        location: u.location,
      });
    }

    // Create connections between users (make a social graph)
    const connectionPairs = [
      [0, 1], [0, 2], [0, 3], [0, 5], [0, 7], [0, 11], [0, 17],
      [1, 2], [1, 3], [1, 8], [1, 9], [1, 16],
      [2, 3], [2, 7], [2, 15],
      [3, 4], [3, 5], [3, 13],
      [4, 5], [4, 6], [4, 16],
      [5, 6], [5, 17],
      [6, 7], [6, 9],
      [7, 8], [7, 15],
      [8, 9], [8, 10],
      [9, 10], [9, 11],
      [10, 11], [10, 12],
      [11, 12], [11, 13],
      [12, 13], [12, 14],
      [13, 14], [13, 15],
      [14, 15], [14, 16],
      [15, 16], [15, 17],
      [16, 17], [16, 18],
      [17, 18], [17, 19],
      [18, 19], [18, 0],
      [19, 0], [19, 1],
    ];

    for (const [a, b] of connectionPairs) {
      if (createdUserIds[a] && createdUserIds[b]) {
        await supabase.from("connections").upsert({
          requester_id: createdUserIds[a],
          receiver_id: createdUserIds[b],
          status: "accepted",
          community_id: "default",
        }, { onConflict: "requester_id,receiver_id" }).then(() => {});
      }
    }

    // Create home feed posts (channel = null for home feed)
    const homePosts = [
      "Just landed my dream job at Google! IIT network really helped. Thanks to everyone who supported 🙏",
      "Looking for co-founders for an EdTech startup. We're building AI-powered tutoring. DM if interested!",
      "Hot take: System design interviews are more about communication than technical knowledge. Change my mind.",
      "Successfully defended my PhD thesis today! 5 years of research finally paying off 🎓",
      "Anyone from IIT Delhi batch of 2024 going to the alumni meetup in Bangalore this weekend?",
      "Just published my first paper in Nature! Quantum error correction is finally making progress 🔬",
      "Tip for freshers: Don't just apply online. Reach out to IIT alumni at target companies. Our network is our superpower!",
      "Excited to announce our startup just raised $2M seed round! Building the future of construction tech 🏗️",
      "The job market is tough right now but don't give up. I applied to 200+ companies before getting my break.",
      "Can't believe I'm saying this but I actually enjoy reading research papers now. PhD life changed me 😅",
      "Great webinar on AI/ML career paths today. Key takeaway: focus on fundamentals, not just frameworks.",
      "Who else thinks the new placement season rules are unfair? Let's discuss.",
      "Sharing my experience transitioning from core engineering to product management. Thread 🧵",
      "Just completed AWS Solutions Architect certification! The cloud is the future ☁️",
      "Looking for mentors in investment banking. Any Goldman Sachs or Morgan Stanley alums here?",
      "Open source contribution tip: Start with documentation fixes. It's the easiest way to get started!",
      "Missing the mess food at IIT. Never thought I'd say that 😂",
      "Launched my side project today - a tool to help students prepare for coding interviews. Check it out!",
      "Controversial opinion: MBA from IIT is underrated compared to IIMs. The tech exposure is unmatched.",
      "3 years post-graduation and I can confidently say the friendships from IIT are the most valuable thing I got.",
      "Interview prep tip: Practice speaking out loud. Technical knowledge means nothing if you can't communicate it.",
      "Just got promoted to Senior SDE! Hard work and consistency pays off 🚀",
      "Anyone interested in a study group for GATE 2026? Drop a comment!",
      "The startup ecosystem in India is booming. Best time to build something of your own!",
      "Sharing my leetcode journey: 500 problems in 6 months. Here's my strategy...",
    ];

    for (let i = 0; i < homePosts.length; i++) {
      const authorIdx = i % createdUserIds.length;
      if (createdUserIds[authorIdx]) {
        await supabase.from("posts").insert({
          content: homePosts[i],
          author_id: createdUserIds[authorIdx],
          is_anonymous: false,
          community_id: "default",
          channel: null,
        });
      }
    }

    // Create forum posts
    const forumGlobalPosts = [
      "What's everyone's opinion on the new GATE syllabus changes?",
      "Looking for study partners for CAT 2026. Anyone interested?",
      "Best resources for learning system design? Drop your recommendations!",
      "How do you deal with imposter syndrome in tech?",
      "Daily coding challenge: Find the longest palindromic substring in O(n) time",
      "Placement season tips: Resume do's and don'ts",
      "The best programming language debate is pointless. Learn to solve problems first.",
      "Who's attending TechSummit 2026 in Bangalore?",
    ];

    for (let i = 0; i < forumGlobalPosts.length; i++) {
      const authorIdx = i % createdUserIds.length;
      if (createdUserIds[authorIdx]) {
        await supabase.from("posts").insert({
          content: forumGlobalPosts[i],
          author_id: createdUserIds[authorIdx],
          is_anonymous: i % 3 === 0,
          community_id: "default",
          channel: "global",
        });
      }
    }

    // Campus posts for IIT Delhi
    const campusPosts = [
      "Library 5th floor is the best study spot. Fight me.",
      "Anyone found their ID card near Bharti building?",
      "The new food court is actually decent. Try the south Indian stall!",
      "Prof Gupta's ML course is the best course I've taken. Highly recommend!",
    ];
    const delhiUsers = createdUserIds.filter((_, i) => testUsers[i]?.iit === "IIT Delhi");
    for (let i = 0; i < campusPosts.length; i++) {
      const authorId = delhiUsers[i % delhiUsers.length];
      if (authorId) {
        await supabase.from("posts").insert({
          content: campusPosts[i],
          author_id: authorId,
          is_anonymous: false,
          community_id: "default",
          channel: "campus",
          campus_filter: "IIT Delhi",
        });
      }
    }

    // Create jobs
    const jobsData = [
      { title: "Senior Frontend Engineer", company: "Google", location: "Bangalore", job_type: "Full-time", experience_level: "3-5 yr", description: "Build next-gen web applications using React and TypeScript. Work on products used by billions.", category: "Engineering" },
      { title: "Product Manager", company: "Microsoft", location: "Hyderabad", job_type: "Full-time", experience_level: "1-3 yr", description: "Define product strategy for Azure services. Lead cross-functional teams.", category: "Product" },
      { title: "ML Engineering Intern", company: "DeepMind", location: "Remote", job_type: "Internship", experience_level: "0-1 mo", description: "Research and implement state-of-the-art ML models. Strong math background required.", category: "AI/ML" },
      { title: "Backend Developer", company: "Flipkart", location: "Bangalore", job_type: "Full-time", experience_level: "1-3 yr", description: "Build scalable microservices for India's largest e-commerce platform.", category: "Engineering" },
      { title: "Data Analyst Intern", company: "Amazon", location: "Chennai", job_type: "Internship", experience_level: "3-6 mo", description: "Analyze customer data to drive business decisions. SQL and Python required.", category: "Data" },
      { title: "UX Designer", company: "Airbnb", location: "Remote", job_type: "Full-time", experience_level: "1-3 yr", description: "Design beautiful, accessible experiences for millions of users worldwide.", category: "Design" },
      { title: "DevOps Engineer", company: "Netflix", location: "Remote", job_type: "Full-time", experience_level: "3-5 yr", description: "Scale infrastructure serving 200M+ subscribers. AWS and Kubernetes expertise needed.", category: "Engineering" },
      { title: "Investment Banking Analyst", company: "Goldman Sachs", location: "Mumbai", job_type: "Full-time", experience_level: "0-1 yr", description: "Join our tech sector coverage team. Financial modeling and valuation skills required.", category: "Finance" },
      { title: "Strategy Consultant", company: "McKinsey", location: "New Delhi", job_type: "Full-time", experience_level: "1-3 yr", description: "Solve complex business problems for Fortune 500 clients.", category: "Consulting" },
      { title: "Full Stack Developer", company: "Razorpay", location: "Bangalore", job_type: "Full-time", experience_level: "1-3 yr", description: "Build India's payment infrastructure. React, Node.js, PostgreSQL.", category: "Engineering" },
      { title: "AI Research Intern", company: "OpenAI", location: "San Francisco", job_type: "Internship", experience_level: "3-6 mo", description: "Work on cutting-edge AI safety research. PhD students preferred.", category: "AI/ML" },
      { title: "Cloud Solutions Architect", company: "AWS", location: "Hyderabad", job_type: "Full-time", experience_level: "5-7 yr", description: "Help enterprise customers design cloud architectures.", category: "Engineering" },
      { title: "Marketing Manager", company: "Swiggy", location: "Bangalore", job_type: "Full-time", experience_level: "3-5 yr", description: "Lead brand marketing campaigns. Data-driven and creative.", category: "Marketing" },
      { title: "Blockchain Developer", company: "Polygon", location: "Remote", job_type: "Part-time", experience_level: "1-3 yr", description: "Build DeFi protocols on Polygon. Solidity and Web3 expertise required.", category: "Engineering" },
      { title: "Sustainability Analyst", company: "EY", location: "Mumbai", job_type: "Full-time", experience_level: "0-1 yr", description: "Help companies measure and reduce their carbon footprint.", category: "Consulting" },
    ];

    for (let i = 0; i < jobsData.length; i++) {
      const creatorIdx = i % createdUserIds.length;
      if (createdUserIds[creatorIdx]) {
        await supabase.from("jobs").insert({
          ...jobsData[i],
          created_by: createdUserIds[creatorIdx],
          community_id: "default",
        });
      }
    }

    // Create chat rooms and messages between connected users
    const chatPairs = [[0, 1], [0, 2], [0, 5], [1, 3], [2, 7], [4, 6]];
    for (const [a, b] of chatPairs) {
      if (createdUserIds[a] && createdUserIds[b]) {
        const { data: room } = await supabase.from("chat_rooms").insert({
          is_group: false, created_by: createdUserIds[a],
        }).select().single();
        if (room) {
          await supabase.from("chat_members").insert([
            { room_id: room.id, user_id: createdUserIds[a] },
            { room_id: room.id, user_id: createdUserIds[b] },
          ]);
          const convos = [
            [`Hey ${testUsers[b].name.split(" ")[0]}! How are you?`, `Hi ${testUsers[a].name.split(" ")[0]}! I'm great, thanks! How about you?`],
            ["Working on anything interesting lately?", "Yeah, been building an AI tool for code review. It's been fun!"],
            ["That sounds amazing! Would love to hear more about it.", "Sure, let's catch up this weekend? ☕"],
          ];
          for (const [msgA, msgB] of convos) {
            await supabase.from("messages").insert({ content: msgA, room_id: room.id, sender_id: createdUserIds[a], read_by: [createdUserIds[a], createdUserIds[b]] });
            await supabase.from("messages").insert({ content: msgB, room_id: room.id, sender_id: createdUserIds[b], read_by: [createdUserIds[b]] });
          }
        }
      }
    }

    // Create a group chat
    if (createdUserIds[0] && createdUserIds[1] && createdUserIds[2] && createdUserIds[5]) {
      const { data: groupRoom } = await supabase.from("chat_rooms").insert({
        name: "IIT Tech Leaders 🚀", is_group: true, created_by: createdUserIds[0],
      }).select().single();
      if (groupRoom) {
        await supabase.from("chat_members").insert([
          { room_id: groupRoom.id, user_id: createdUserIds[0] },
          { room_id: groupRoom.id, user_id: createdUserIds[1] },
          { room_id: groupRoom.id, user_id: createdUserIds[2] },
          { room_id: groupRoom.id, user_id: createdUserIds[5] },
        ]);
        const groupMsgs = [
          { sender: 0, content: "Welcome everyone to our tech leaders group! 🎉" },
          { sender: 1, content: "Excited to be here! Great initiative." },
          { sender: 2, content: "Let's share interesting articles and job opportunities here." },
          { sender: 5, content: "Perfect! I'll share some ML papers I've been reading." },
          { sender: 0, content: "Also, anyone up for a weekend hackathon?" },
          { sender: 1, content: "Count me in! 💪" },
        ];
        for (const msg of groupMsgs) {
          await supabase.from("messages").insert({
            content: msg.content, room_id: groupRoom.id,
            sender_id: createdUserIds[msg.sender],
            read_by: [createdUserIds[msg.sender]],
          });
        }
      }
    }

    // Add reactions to posts
    const { data: allPosts } = await supabase.from("posts").select("id").is("channel", null).limit(25);
    const emojis = ["👍", "❤️", "😂", "🔥"];
    if (allPosts) {
      for (let i = 0; i < allPosts.length; i++) {
        const numReactions = 2 + Math.floor(Math.random() * 5);
        for (let j = 0; j < numReactions; j++) {
          const reactorIdx = (i + j + 1) % createdUserIds.length;
          if (createdUserIds[reactorIdx]) {
            await supabase.from("reactions").insert({
              entity_type: "post", entity_id: allPosts[i].id,
              user_id: createdUserIds[reactorIdx],
              emoji: emojis[j % emojis.length],
            }).then(() => {});
          }
        }
      }
    }

    // Add comments to posts
    const comments = [
      "Great insight! Thanks for sharing.", "Completely agree with this!", "This is so relatable 😂",
      "Can you share more details?", "Amazing work! Congratulations 🎉", "Very helpful, saved this post.",
      "This is exactly what I needed to hear today.", "Inspiring! 🙌", "Well said! Keep it up.",
    ];
    if (allPosts) {
      for (let i = 0; i < Math.min(allPosts.length, 15); i++) {
        const numComments = 1 + Math.floor(Math.random() * 3);
        for (let j = 0; j < numComments; j++) {
          const commenterIdx = (i + j + 2) % createdUserIds.length;
          if (createdUserIds[commenterIdx]) {
            await supabase.from("comments").insert({
              post_id: allPosts[i].id,
              author_id: createdUserIds[commenterIdx],
              content: comments[(i + j) % comments.length],
            });
          }
        }
      }
    }

    // Create events
    const events = [
      { title: "IIT Alumni Meetup - Bangalore", description: "Annual alumni networking event. Open to all IITians.", location: "Taj Hotel, Bangalore", days_from_now: 7 },
      { title: "AI/ML Workshop", description: "Hands-on workshop on building LLM applications.", location: "Virtual (Zoom)", days_from_now: 3 },
      { title: "Startup Pitch Night", description: "Present your startup idea to investors and mentors.", location: "WeWork, Mumbai", days_from_now: 14 },
      { title: "Career Fair 2026", description: "Top companies recruiting IIT graduates.", location: "IIT Delhi Campus", days_from_now: 21 },
    ];
    for (let i = 0; i < events.length; i++) {
      const start = new Date();
      start.setDate(start.getDate() + events[i].days_from_now);
      if (createdUserIds[i]) {
        await supabase.from("events").insert({
          title: events[i].title, description: events[i].description,
          location: events[i].location, start_time: start.toISOString(),
          created_by: createdUserIds[i], community_id: "default",
        });
      }
    }

    // ===== MASSIVE FORUM SEEDING =====

    // Helper to create a post with offset time
    const forumPost = async (content: string, authorIdx: number, channel: string, opts: any = {}) => {
      const offset = opts.minutesAgo || 0;
      const created = new Date(Date.now() - offset * 60 * 1000).toISOString();
      const authorId = createdUserIds[authorIdx % createdUserIds.length];
      if (!authorId) return null;
      const { data } = await supabase.from("posts").insert({
        content,
        author_id: authorId,
        is_anonymous: opts.anon || false,
        community_id: "default",
        channel,
        campus_filter: opts.campus || null,
        cohort_filter: opts.cohort || null,
        scope_type: opts.scope_type || null,
        scope_key: opts.scope_key || null,
        image_url: opts.image || null,
        created_at: created,
      }).select("id").single();
      return data;
    };

    // --- GLOBAL CHANNEL: 25+ messages ---
    const globalMsgs = [
      { c: "🔥 Hot take: Rust will replace C++ in systems programming within 5 years", a: 0, m: 480 },
      { c: "Disagree. C++ has too much legacy code. Maybe 15 years.", a: 8, m: 475 },
      { c: "Has anyone tried the new Claude 4 model? It's insane for coding", a: 2, m: 460 },
      { c: "Yeah I've been using it for my research. The reasoning is next level", a: 7, m: 455 },
      { c: "Just got my H1B approved! 🎉 After 3 attempts. Don't give up folks!", a: 17, m: 440 },
      { c: "Congrats!! Which company?", a: 5, m: 438 },
      { c: "Stripe! Super excited to join the payments team", a: 17, m: 435 },
      { c: "Anyone preparing for Google L5 interviews? Need a study buddy", a: 0, m: 400 },
      { c: "I'm preparing too! Let's create a group. DM me", a: 3, m: 395 },
      { c: "Pro tip: Focus on behavioral rounds. Most people underestimate them", a: 1, m: 390 },
      { c: "📢 Announcement: IIT Alumni Hackathon registrations are open! Link in bio", a: 4, m: 360 },
      { c: "What's the prize pool?", a: 10, m: 355 },
      { c: "₹5L first place, ₹2L second, ₹1L third. Plus mentorship from VCs", a: 4, m: 350 },
      { c: "I'm in! Forming a team. Need a frontend dev and a designer", a: 14, m: 345 },
      { c: "Count me in for frontend! React + TypeScript is my jam 🚀", a: 3, m: 340 },
      { c: "The salary thread is getting heated on Blind lol. IIT grads claiming 50LPA base is low 😂", a: 6, m: 300 },
      { c: "Honestly in Bangalore with current rent prices, 50LPA doesn't feel like much", a: 9, m: 295 },
      { c: "Y'all need to see the world outside tech. 50LPA is top 1% in India.", a: 12, m: 290 },
      { c: "True. Perspective matters. But also, cost of living in metro cities is insane", a: 11, m: 285 },
      { c: "Just deployed my first production ML model today. Feels surreal! 🤖", a: 2, m: 250 },
      { c: "What stack did you use? MLflow + Kubernetes?", a: 7, m: 245 },
      { c: "Actually went with Vertex AI on GCP. Way simpler for small teams", a: 2, m: 240 },
      { c: "Nice! GCP's ML tooling is underrated imo", a: 5, m: 235 },
      { c: "Weekend plan: Netflix, biryani, and zero coding. Who's with me? 😴", a: 10, m: 200 },
      { c: "Impossible. I'll end up opening VS Code within 2 hours guaranteed", a: 8, m: 195 },
      { c: "This is the most relatable thing I've read today 😂", a: 13, m: 190 },
      { c: "Anyone else feel like LinkedIn is becoming Instagram? Every post is a humble brag now", a: 15, m: 150 },
      { c: "\"Thrilled to announce\" energy is real 💀", a: 16, m: 145 },
      { c: "That's why I prefer this forum. Real conversations, no performative posting", a: 19, m: 140 },
      { c: "Exactly! This community feels like what LinkedIn should have been", a: 11, m: 135 },
      { c: "🚨 PSA: There's a phishing email going around targeting IIT alumni. Don't click any 'alumni verification' links!", a: 4, m: 100 },
      { c: "Thanks for the heads up! I almost clicked it yesterday", a: 18, m: 95 },
      { c: "Report it to the admin team. They can send a warning to everyone", a: 1, m: 90 },
    ];

    const globalPostIds: string[] = [];
    for (const msg of globalMsgs) {
      const post = await forumPost(msg.c, msg.a, "global", { minutesAgo: msg.m });
      if (post) globalPostIds.push(post.id);
    }

    // --- GLOBAL THREAD REPLIES (reply_to_id) ---
    if (globalPostIds.length > 5) {
      // Thread on Rust vs C++ (replies to first message)
      const threadReplies = [
        { c: "As someone who writes both daily, Rust's borrow checker is a game changer for safety", a: 12, m: 470 },
        { c: "But the learning curve is brutal. My team took 6 months to be productive", a: 6, m: 465 },
        { c: "Worth it though. We haven't had a single memory bug since switching", a: 12, m: 460 },
        { c: "The real question is whether LLVM will keep up with Rust's rapid evolution", a: 15, m: 455 },
      ];
      for (const r of threadReplies) {
        const authorId = createdUserIds[r.a % createdUserIds.length];
        if (authorId) {
          await supabase.from("posts").insert({
            content: r.c, author_id: authorId, is_anonymous: false,
            community_id: "default", channel: "global",
            reply_to_id: globalPostIds[0],
            created_at: new Date(Date.now() - r.m * 60 * 1000).toISOString(),
          });
        }
      }

      // Thread on Google L5 interview prep
      const interviewThread = [
        { c: "I got L5 last year. Happy to share my prep strategy", a: 0, m: 385 },
        { c: "Please do! How long did you prepare?", a: 3, m: 380 },
        { c: "3 months. 2 LC mediums/day + 1 system design session/week. Key is consistency", a: 0, m: 375 },
        { c: "What about the Googleyness round? That was the hardest for me", a: 9, m: 370 },
        { c: "Use the STAR method. Have 10 strong stories ready. Practice out loud", a: 0, m: 365 },
        { c: "This is gold. Thanks! 🙏", a: 14, m: 360 },
      ];
      for (const r of interviewThread) {
        const authorId = createdUserIds[r.a % createdUserIds.length];
        if (authorId) {
          await supabase.from("posts").insert({
            content: r.c, author_id: authorId, is_anonymous: false,
            community_id: "default", channel: "global",
            reply_to_id: globalPostIds[7], // Google L5 post
            created_at: new Date(Date.now() - r.m * 60 * 1000).toISOString(),
          });
        }
      }
    }

    // --- CAMPUS CHANNEL: IIT Delhi messages ---
    const campusMsgsExtra = [
      { c: "Hostel wifi is down again 😭 Anyone else facing this?", a: 0, m: 500 },
      { c: "Same here in Aravali. Using mobile data rn", a: 5, m: 495 },
      { c: "IT dept said they're upgrading the network. Should be back by evening", a: 11, m: 490 },
      { c: "📚 Selling my DSA textbook (Cormen). DM if interested. ₹400 only", a: 17, m: 450 },
      { c: "Is Prof. Amitabha's Networks course worth taking as an elective?", a: 0, m: 400 },
      { c: "Absolutely! Best prof in the department. His assignments are tough but you learn a LOT", a: 11, m: 395 },
      { c: "The placement cell just released new guidelines. No more day 1 dream company restrictions!", a: 5, m: 350 },
      { c: "Finally! This was long overdue", a: 17, m: 345 },
      { c: "🎭 Rendezvous dates announced: March 15-17. Start planning your acts!", a: 11, m: 300 },
      { c: "Drama club auditions start next Monday. All years welcome!", a: 0, m: 250 },
      { c: "Lost my blue water bottle in LHC-325 yesterday. Has anyone seen it?", a: 5, m: 200 },
      { c: "Check with the security office near the main gate. They have a lost & found", a: 17, m: 195 },
    ];
    for (const msg of campusMsgsExtra) {
      const dUser = delhiUsers[msg.a % delhiUsers.length] || createdUserIds[msg.a % createdUserIds.length];
      if (dUser) {
        await supabase.from("posts").insert({
          content: msg.c, author_id: dUser, is_anonymous: false,
          community_id: "default", channel: "campus", campus_filter: "IIT Delhi",
          created_at: new Date(Date.now() - msg.m * 60 * 1000).toISOString(),
        });
      }
    }

    // --- CAMPUS CHANNEL: IIT Bombay ---
    const bombayUsers = createdUserIds.filter((_, i) => testUsers[i]?.iit === "IIT Bombay");
    const bombayMsgs = [
      { c: "Mood Indigo lineup just dropped! We got Prateek Kuhad!! 🎶", a: 1, m: 600 },
      { c: "YESSSS finally! His concert at MI last year was legendary", a: 8, m: 595 },
      { c: "Anyone forming a team for E-Summit case competition?", a: 16, m: 550 },
      { c: "Powai lake sunset views hit different during exam season 🌅", a: 8, m: 500 },
      { c: "That's a weird way to say you're procrastinating 😂", a: 1, m: 495 },
      { c: "H10 mess finally improved their menu. The paneer is actually edible now", a: 16, m: 400 },
      { c: "Don't jinx it. Last time someone said that, they went back to old menu next week", a: 8, m: 395 },
    ];
    for (const msg of bombayMsgs) {
      const bUser = bombayUsers[msg.a % bombayUsers.length] || createdUserIds[msg.a % createdUserIds.length];
      if (bUser) {
        await supabase.from("posts").insert({
          content: msg.c, author_id: bUser, is_anonymous: false,
          community_id: "default", channel: "campus", campus_filter: "IIT Bombay",
          created_at: new Date(Date.now() - msg.m * 60 * 1000).toISOString(),
        });
      }
    }

    // --- ANONYMOUS CONFESSIONS in global ---
    const anonMsgs = [
      { c: "Confession: I still Google how to center a div 💀", m: 180 },
      { c: "I pretend to understand distributed systems in meetings. Nobody has caught on yet.", m: 160 },
      { c: "Hot take: I'd rather write documentation than code. Am I broken?", m: 120 },
    ];
    for (let i = 0; i < anonMsgs.length; i++) {
      await forumPost(anonMsgs[i].c, i + 7, "global", { minutesAgo: anonMsgs[i].m, anon: true });
    }

    // --- POLLS ---
    // Poll 1: Best programming language
    const pollPost1 = await forumPost("⚡ Poll: What's the best programming language for 2026?", 4, "global", { minutesAgo: 320 });
    if (pollPost1) {
      const { data: poll1 } = await supabase.from("polls").insert({
        post_id: pollPost1.id,
        question: "What's the best programming language for 2026?",
        options: JSON.stringify(["Python", "TypeScript", "Rust", "Go"]),
      }).select("id").single();
      if (poll1) {
        for (let i = 0; i < 12; i++) {
          const uid = createdUserIds[i % createdUserIds.length];
          if (uid) {
            await supabase.from("poll_votes").insert({
              poll_id: poll1.id, user_id: uid,
              option_index: i % 4,
            }).then(() => {});
          }
        }
      }
    }

    // Poll 2: Remote vs office
    const pollPost2 = await forumPost("📊 Remote work vs office - what do you prefer?", 1, "global", { minutesAgo: 220 });
    if (pollPost2) {
      const { data: poll2 } = await supabase.from("polls").insert({
        post_id: pollPost2.id,
        question: "Remote work vs office?",
        options: JSON.stringify(["Fully Remote", "Hybrid (2-3 days)", "Fully In-Office", "Depends on role"]),
      }).select("id").single();
      if (poll2) {
        for (let i = 0; i < 15; i++) {
          const uid = createdUserIds[i % createdUserIds.length];
          if (uid) {
            await supabase.from("poll_votes").insert({
              poll_id: poll2.id, user_id: uid,
              option_index: i < 6 ? 1 : i < 10 ? 0 : i < 13 ? 3 : 2,
            }).then(() => {});
          }
        }
      }
    }

    // --- REACTIONS on forum posts ---
    const allForumPosts = await supabase.from("posts").select("id").not("channel", "is", null).limit(50);
    const reactionEmojis = ["👍", "❤️", "😂", "🔥", "👏", "🎯", "💯", "🚀"];
    if (allForumPosts.data) {
      for (let i = 0; i < allForumPosts.data.length; i++) {
        const numReactions = 1 + Math.floor(Math.random() * 6);
        for (let j = 0; j < numReactions; j++) {
          const reactorIdx = (i + j + 2) % createdUserIds.length;
          if (createdUserIds[reactorIdx]) {
            await supabase.from("reactions").insert({
              entity_type: "forum_msg",
              entity_id: allForumPosts.data[i].id,
              user_id: createdUserIds[reactorIdx],
              emoji: reactionEmojis[(i + j) % reactionEmojis.length],
            }).then(() => {});
          }
        }
      }
    }

    // --- Home post reactions ---
    const { data: homePostsForReactions } = await supabase.from("posts").select("id").is("channel", null).limit(25);
    if (homePostsForReactions) {
      for (let i = 0; i < homePostsForReactions.length; i++) {
        const numReactions = 2 + Math.floor(Math.random() * 5);
        for (let j = 0; j < numReactions; j++) {
          const reactorIdx = (i + j + 1) % createdUserIds.length;
          if (createdUserIds[reactorIdx]) {
            await supabase.from("reactions").insert({
              entity_type: "post", entity_id: homePostsForReactions[i].id,
              user_id: createdUserIds[reactorIdx],
              emoji: reactionEmojis[j % reactionEmojis.length],
            }).then(() => {});
          }
        }
      }
    }

    // Create consultations
    if (createdUserIds[0] && createdUserIds[4]) {
      await supabase.from("consultations").insert({
        consultant_id: createdUserIds[4],
        client_id: createdUserIds[0],
        consultation_type: "video",
        status: "confirmed",
        amount: 1200,
        duration_minutes: 30,
        notes: "Want to discuss startup fundraising strategy",
        scheduled_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      usersCreated: createdUserIds.length,
      forumPostsCreated: globalPostIds.length + campusMsgsExtra.length + bombayMsgs.length + anonMsgs.length + 2,
      message: `Seeded ${createdUserIds.length} users, 60+ forum messages with threads, polls, reactions, and more.`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
