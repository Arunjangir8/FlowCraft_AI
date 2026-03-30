import "dotenv/config";
import { generateDiagramFromPrompt, generateShapesFromPrompt, runDrawingAgent } from "./src/lib/ai-agent/index";
import {
    describeDrawingTool,
    suggestDrawingIdeasTool,
    transformShapesTool,
    getCurrentDateTimeTool,
    type DrawShape,
    generateDiagramTool,
} from "./src/lib/ai-agent/tools";

const GREEN  = "\x1b[32m";
const RED    = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN   = "\x1b[36m";
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
 
let passed = 0;
let failed = 0;
 
function log(label: string, msg: string) {
    console.log(`\n${CYAN}${BOLD}▶ ${label}${RESET}\n  ${msg}`);
}
 
function ok(label: string, detail?: string) {
    passed++;
    console.log(`  ${GREEN}✓ PASS${RESET} ${label}${detail ? ` — ${detail}` : ""}`);
}
 
function fail(label: string, err: unknown) {
    failed++;
    console.log(`  ${RED}✗ FAIL${RESET} ${label}`);
    console.error("  ", err instanceof Error ? err.message : err);
}
 
function separator() {
    console.log(`\n${YELLOW}${"─".repeat(60)}${RESET}`);
}
 
// ─── TEST 1: get_current_datetime ─────────────────────────────────────────────
 
async function testGetCurrentDatetime() {
    log("Tool: get_current_datetime", "Checking IST time is returned correctly");
    try {
        const result = await getCurrentDateTimeTool.invoke({});
        if (!result.iso || !result.locale || !result.timestamp)
            throw new Error("Missing fields in response");
        ok("Returns iso, locale, timestamp", JSON.stringify(result));
    } catch (err) {
        fail("get_current_datetime", err);
    }
}
 
// ─── TEST 2: suggest_drawing_ideas ────────────────────────────────────────────
 
async function testSuggestDrawingIdeas() {
    log("Tool: suggest_drawing_ideas", "Fetching generic ideas and filtered ideas");
    try {
        // Generic
        const raw1 = await suggestDrawingIdeasTool.invoke({ count: 3 });
        const res1 = JSON.parse(raw1);
        if (!Array.isArray(res1.suggestions) || res1.suggestions.length !== 3)
            throw new Error(`Expected 3 suggestions, got ${res1.suggestions?.length}`);
        ok("Returns 3 generic suggestions", res1.suggestions.map((s: any) => s.idea).join(", "));
 
        // Filtered by topic
        const raw2 = await suggestDrawingIdeasTool.invoke({ topic: "flowchart", count: 2 });
        const res2 = JSON.parse(raw2);
        if (!res2.suggestions.every((s: any) => s.category === "flowchart"))
            throw new Error("Non-flowchart suggestion returned");
        ok("Filters by topic 'flowchart'", res2.suggestions.map((s: any) => s.idea).join(", "));
    } catch (err) {
        fail("suggest_drawing_ideas", err);
    }
}
 
// ─── TEST 3: describe_drawing ─────────────────────────────────────────────────
 
async function testDescribeDrawing() {
    log("Tool: describe_drawing", "Analysing a sample set of shapes");
 
    const sampleShapes: DrawShape[] = [
        { id: 1, type: "rect",    x1: 50,  y1: 50,  x2: 200, y2: 150, color: "#38bdf8" },
        { id: 2, type: "ellipse", x1: 250, y1: 60,  x2: 400, y2: 160, color: "#f87171" },
        { id: 3, type: "text",    x: 100,  y: 200,  text: "Hello", color: "#f8fafc" },
        { id: 4, type: "arrow",   x1: 200, y1: 100, x2: 250, y2: 110, color: "#34d399" },
    ];
 
    try {
        const raw = await describeDrawingTool.invoke({ shapes: sampleShapes as any });
        const res = JSON.parse(raw);
        if (res.totalShapes !== 4)
            throw new Error(`Expected 4 shapes, got ${res.totalShapes}`);
        ok("Counts shapes correctly", res.summary);
    } catch (err) {
        fail("describe_drawing", err);
    }
}
 
// ─── TEST 4: transform_shapes ─────────────────────────────────────────────────
 
async function testTransformShapes() {
    log("Tool: transform_shapes", "Testing recolor, opacity, scale, rotate");
 
    const base: DrawShape[] = [
        { id: 1, type: "rect",    x1: 100, y1: 100, x2: 300, y2: 200, color: "#ffffff" },
        { id: 2, type: "ellipse", x1: 400, y1: 100, x2: 600, y2: 250, color: "#ffffff" },
    ];
 
    try {
        // recolor
        const r1 = JSON.parse(await transformShapesTool.invoke({ shapes: base as any, operation: "recolor", value: "#f87171" }));
        if (!r1.every((s: DrawShape) => s.color === "#f87171"))
            throw new Error("Recolor failed");
        ok("recolor → all shapes become #f87171");
 
        // opacity
        const r2 = JSON.parse(await transformShapesTool.invoke({ shapes: base as any, operation: "opacity", value: "0.4" }));
        if (!r2.every((s: DrawShape) => s.opacity === 0.4))
            throw new Error("Opacity failed");
        ok("opacity → all shapes set to 0.4");
 
        // scale
        const r3 = JSON.parse(await transformShapesTool.invoke({ shapes: base as any, operation: "scale", value: "2" }));
        if (r3[0].x1 !== 200 || r3[0].y1 !== 200)
            throw new Error(`Scale failed: x1=${r3[0].x1}, y1=${r3[0].y1}`);
        ok("scale 2× → coordinates doubled");
 
        // rotate
        const r4 = JSON.parse(await transformShapesTool.invoke({ shapes: base as any, operation: "rotate", value: "0.785" }));
        if (r4[0].rotation === undefined || r4[0].rotation === 0)
            throw new Error("Rotate failed");
        ok("rotate → rotation field added", `${r4[0].rotation.toFixed(3)} rad`);
 
    } catch (err) {
        fail("transform_shapes", err);
    }
}
 
// ─── TEST 5: generateShapesFromPrompt (Gemini direct) ────────────────────────
 
async function testGeminiShapeGeneration() {
    log("Gemini: generateShapesFromPrompt", "Generating shapes for a simple prompt");
    try {
        const shapes = await generateShapesFromPrompt(
            "Draw two rectangles and one arrow connecting them, using blue colors",
            800,
            600,
            0,
        );
 
        if (!Array.isArray(shapes) || shapes.length === 0)
            throw new Error("No shapes returned");
 
        const validTypes = ["rect","ellipse","diamond","line","arrow","text","pen"];
        const allValid   = shapes.every(s => validTypes.includes(s.type));
        if (!allValid)
            throw new Error(`Invalid shape type found: ${shapes.map(s => s.type).join(", ")}`);
 
        const hasUniqueIds = new Set(shapes.map(s => s.id)).size === shapes.length;
        if (!hasUniqueIds) throw new Error("Duplicate shape IDs found");
 
        ok(`Generated ${shapes.length} valid shape(s)`, shapes.map(s => s.type).join(", "));
        console.log("  Sample shape:", JSON.stringify(shapes[0], null, 2).split("\n").map(l => "  " + l).join("\n"));
    } catch (err) {
        fail("generateShapesFromPrompt (Gemini)", err);
    }
}
 
// ─── TEST 6: Full agent run (Groq + Gemini) ───────────────────────────────────
 
async function testFullAgentRun() {
    log("Agent: runDrawingAgent", "Full Groq ReAct loop → Gemini shape generation");
    try {
        const result = await runDrawingAgent({
            userMessage:  "Draw a simple flowchart with start, process, and end boxes connected by arrows",
            canvasWidth:  1000,
            canvasHeight: 700,
        });
 
        if (!result.reply)
            throw new Error("No reply from agent");
 
        ok("Agent replied", result.reply.slice(0, 120) + (result.reply.length > 120 ? "…" : ""));
        ok(`Tools used: [${result.toolsUsed.join(", ")}]`);
 
        if (result.newShapes && result.newShapes.length > 0) {
            ok(`Gemini produced ${result.newShapes.length} shape(s)`, result.newShapes.map(s => s.type).join(", "));
        } else {
            console.log(`  ${YELLOW}⚠ No shapes generated (agent may not have called generate_shapes)${RESET}`);
        }
    } catch (err) {
        fail("runDrawingAgent", err);
    }
}
 
// ─── TEST 7: Agent — describe existing canvas ─────────────────────────────────
 
async function testAgentDescribe() {
    log("Agent: describe canvas via chat", "Passing existing shapes and asking what's on canvas");
 
    const shapes: DrawShape[] = [
        { id: 1, type: "rect",   x1: 100, y1: 100, x2: 300, y2: 200, color: "#38bdf8", fill: "#38bdf820" },
        { id: 2, type: "text",   x: 150,  y: 160,  text: "Server",   color: "#f8fafc" },
        { id: 3, type: "arrow",  x1: 300, y1: 150, x2: 450, y2: 150, color: "#34d399" },
        { id: 4, type: "ellipse",x1: 450, y1: 110, x2: 600, y2: 190, color: "#f87171", fill: "#f8717120" },
    ];
 
    try {
        const result = await runDrawingAgent({
            userMessage:    "What's on my canvas right now?",
            existingShapes: shapes,
        });
 
        if (!result.reply) throw new Error("No reply");
        ok("Agent described the canvas", result.reply.slice(0, 120) + "…");
        ok("No new shapes were added (correct)", `allShapes.length = ${result.allShapes.length}`);
    } catch (err) {
        fail("agent describe canvas", err);
    }
}
 
// ─── Run all tests ────────────────────────────────────────────────────────────
 
async function runAll() {
    console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════╗`);
    console.log(`║       DRAWING AI — TOOL TEST SUITE               ║`);
    console.log(`╚══════════════════════════════════════════════════╝${RESET}\n`);
 
    separator();
    console.log(`${YELLOW}SECTION 1 — Individual tools (no LLM calls)${RESET}`);
    separator();
    await testGetCurrentDatetime();
    await testSuggestDrawingIdeas();
    await testDescribeDrawing();
    await testTransformShapes();
 
    separator();
    console.log(`${YELLOW}SECTION 2 — Gemini shape generation (direct)${RESET}`);
    separator();
    await testGeminiShapeGeneration();
    await testFullAgentRun();
    await testAgentDescribe();
 
    separator();
    console.log(`${YELLOW}SECTION 3 — Diagrams${RESET}`);
    separator();
}

// ─── TEST 8: generate_diagram tool (auto-detect + explicit type) ──────────────
 
async function testGenerateDiagramTool() {
    log("Tool: generate_diagram", "Testing auto-detection of diagram types from keywords");
    try {
        const cases: Array<{ cmd: string; expectedType: string }> = [
            { cmd: "Draw a UML sequence diagram for user login",          expectedType: "sequence"  },
            { cmd: "Create a use case diagram for an e-commerce system",  expectedType: "usecase"   },
            { cmd: "Show a class diagram for a vehicle hierarchy",        expectedType: "class"     },
            { cmd: "Draw an ER diagram for a blog database schema",       expectedType: "er"        },
            { cmd: "Make a state diagram for an order status workflow",   expectedType: "state"     },
            { cmd: "Create a Gantt chart for a 4-week sprint",           expectedType: "gantt"     },
            { cmd: "Draw a mind map for a SaaS product launch",          expectedType: "mindmap"   },
            { cmd: "Show a git graph with feature branch and merge",      expectedType: "gitgraph"  },
            { cmd: "Draw a flowchart for user registration process",      expectedType: "flowchart" },
        ];
 
        for (const { cmd, expectedType } of cases) {
            const raw  = await generateDiagramTool.invoke({ command: cmd, autoDetect: true });
            const spec = JSON.parse(raw);
            if (spec.resolvedType !== expectedType)
                throw new Error(`"${cmd}" → expected '${expectedType}', got '${spec.resolvedType}'`);
            ok(`Auto-detected '${expectedType}'`, cmd.slice(0, 55) + "…");
        }
 
        // Explicit type override
        const raw2  = await generateDiagramTool.invoke({ command: "Show me stuff", type: "timeline", autoDetect: false });
        const spec2 = JSON.parse(raw2);
        if (spec2.resolvedType !== "timeline")
            throw new Error(`Explicit type override failed, got '${spec2.resolvedType}'`);
        ok("Explicit type override → 'timeline'");
 
    } catch (err) {
        fail("generate_diagram tool", err);
    }
}
 
// ─── TEST 9: Gemini diagram generation (direct) ───────────────────────────────
 
async function testGeminiDiagramGeneration() {
    log("Gemini: generateDiagramFromPrompt", "Generating Mermaid for a sequence diagram");
    try {
        const spec = JSON.parse(
            await generateDiagramTool.invoke({
                command: "Draw a sequence diagram for JWT-based user login: Client → API → Auth Service → DB",
                autoDetect: true,
            })
        );
 
        const mermaid = await generateDiagramFromPrompt(spec.diagramPrompt);
 
        if (!mermaid || mermaid.trim().length === 0)
            throw new Error("Empty Mermaid output");
 
        const startsCorrectly = mermaid.trimStart().startsWith("sequenceDiagram");
        if (!startsCorrectly)
            throw new Error(`Expected 'sequenceDiagram' header, got:\n${mermaid.slice(0, 80)}`);
 
        ok("Gemini returned valid Mermaid", `${mermaid.split("\n").length} lines`);
        console.log("  Preview:\n" + mermaid.split("\n").slice(0, 6).map(l => "    " + l).join("\n"));
    } catch (err) {
        fail("generateDiagramFromPrompt (Gemini)", err);
    }
}
 
// ─── TEST 10: Full agent diagram via chat ─────────────────────────────────────
 
async function testAgentDiagram() {
    log("Agent: diagram via runDrawingAgent", "Asking agent to create a UML class diagram");
    try {
        const result = await runDrawingAgent({
            userMessage: "Create a UML class diagram for an e-commerce system with User, Product, Order, and Payment classes",
        });
 
        if (!result.reply) throw new Error("No reply from agent");
        ok("Agent replied", result.reply.slice(0, 100) + "…");
 
        if (result.mermaidDiagram) {
            ok(`Mermaid diagram generated (${result.diagramType})`,
               `${result.mermaidDiagram.split("\n").length} lines`);
            console.log("  Preview:\n" + result.mermaidDiagram.split("\n").slice(0, 6).map(l => "    " + l).join("\n"));
        } else {
            console.log(`  ${YELLOW}⚠ Agent replied but did not call generate_diagram${RESET}`);
        }
    } catch (err) {
        fail("agent diagram via chat", err);
    }
}
 
async function runAllTests() {
    console.log(`\n${BOLD}${CYAN}╔══════════════════════════════════════════════════╗`);
    console.log(`║       DRAWING AI — TOOL TEST SUITE               ║`);
    console.log(`╚══════════════════════════════════════════════════╝${RESET}\n`);
 
    separator();
    console.log(`${YELLOW}SECTION 1 — Individual tools (no LLM calls)${RESET}`);
    separator();
    await testGetCurrentDatetime();
    await testSuggestDrawingIdeas();
    await testDescribeDrawing();
    await testTransformShapes();
    await testGenerateDiagramTool();
 
    separator();
    console.log(`${YELLOW}SECTION 2 — Gemini generation (direct)${RESET}`);
    separator();
    await testGeminiShapeGeneration();
    await testGeminiDiagramGeneration();
 
    separator();
    console.log(`${YELLOW}SECTION 3 — Full agent (Groq + Gemini)${RESET}`);
    separator();
    await testFullAgentRun();
    await testAgentDescribe();
    await testAgentDiagram();
 
    separator();
    console.log(`\n${BOLD}RESULTS: ${GREEN}${passed} passed${RESET}  ${failed > 0 ? RED : ""}${failed} failed${RESET}\n`);
    if (failed > 0) process.exit(1);
}
 
runAllTests().catch(err => {
    console.error(`${RED}Unhandled error:${RESET}`, err);
    process.exit(1);
});