import os
import re
import json

SOURCE_FILE = "/mnt/c/Users/eidol/Desktop/WebTool/WebTool_Modular_Reset/feasibility-melbourne-en-cc.html"
TARGET_DIR = "/mnt/c/Users/eidol/Desktop/WebTool/WebTool_SaaS/"

LOGIC_MANIFEST = {
    "Financials": ["calcVicStampDuty", "calcGST", "calcTrueIRR", "calcRLVIterative", "buildIRRCashFlows", "S-Curve", "Newton-Raphson", "SRO VIC", "LVR", "TDC"],
    "Spatial/Planning": ["calcCBDDist", "normaliseZone", "getNatureStripTrees", "calcOverlayTimeline", "LGA_OSC", "LGA_ALERTS", "S.173", "VPO", "HO", "SLO", "BMO"],
    "Risk/Governance": ["calcRiskAdjustedMargin", "calculateFeasibilityScore", "scoreToBand", "calcFreshness", "calculateQualitySignals", " la-rated"],
    "Constants/Data": ["ZONE_RULES", "MEL_SUBURBS", "CONSTR_COST", "COUNCIL_DB"],
    "Export/UI": ["generateObsidianMD", "exportProjectJSON", "jspdf", "Google Tasks"]
}

def audit():
    target_content = ""
    for root, dirs, files in os.walk(TARGET_DIR):
        if 'node_modules' in root:
            continue
        for file in files:
            if file.endswith((".js", ".jsx")):
                with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                    target_content += f.read() + "\n"

    results = {"passed": [], "missing": [], "completion_rate": 0}
    total_checks = 0
    passed_checks = 0
    
    for category, anchors in LOGIC_MANIFEST.items():
        for anchor in anchors:
            total_checks += 1
            if re.search(re.escape(anchor), target_content, re.IGNORECASE):
                results["passed"].append(anchor)
                passed_checks += 1
            else:
                results["missing"].append(anchor)
                
    results["completion_rate"] = (passed_checks / total_checks) * 100
    return results

if __name__ == "__main__":
    print(json.dumps(audit()))
