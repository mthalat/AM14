const express = require("express");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

const GROQ_API_KEY = process.env.GROQ_API_KEY;

if (!GROQ_API_KEY) {
  console.error("ERROR: GROQ_API_KEY environment variable is not set!");
}
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ----- RECIPES -----
app.post("/api/fridge/recipes", async (req, res) => {
  try {
    const ingredients = req.body.ingredients || [];

    if (!ingredients.length) {
      return res.json({ error: "No ingredients provided", recipes: [] });
    }

    const prompt = `أنت طاهٍ محترف. المستخدم لديه هذه المكونات في ثلاجته: ${ingredients.join(", ")}

قم بإنشاء 3 وصفات طبخ إبداعية باستخدام هذه المكونات.

أعد الرد بتنسيق JSON التالي فقط، بدون أي نص إضافي:
{
  "recipes": [
    {
      "title": "اسم الوصفة",
      "calories": 350,
      "servings": 4,
      "ingredients": ["المكون 1 الموجود في الثلاجة", "المكون 2"],
      "missing": ["مكون ناقص اختياري"],
      "steps": ["الخطوة الأولى", "الخطوة الثانية", "الخطوة الثالثة"]
    }
  ]
}

ملاحظات:
- ingredients: فقط المكونات الموجودة مع المستخدم
- missing: المكونات الإضافية الاختيارية التي قد تحسّن الوصفة (يمكن تركها فارغة [])
- steps: خطوات تفصيلية للتحضير
- calories: السعرات الحرارية التقريبية للوجبة الواحدة
- servings: عدد الأشخاص`;

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq API error:", errText);
      return res.json({ error: "API error: " + errText, recipes: [] });
    }

    const data = await response.json();
    let text = data?.choices?.[0]?.message?.content || "{}";

    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { recipes: [] };
    }

    res.json(json);
  } catch (e) {
    console.error("Recipe error:", e);
    res.json({ error: e.message, recipes: [] });
  }
});

// fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
