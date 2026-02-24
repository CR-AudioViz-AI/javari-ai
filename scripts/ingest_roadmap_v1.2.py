#!/usr/bin/env python3
"""
JAVARI Roadmap Ingestion Script v1.2
Loads Master Blueprint into Supabase via verified proxies

Usage:
  python3 ingest_roadmap_v1.2.py [--dry-run]

Environment Variables Required:
  - None (uses public API endpoints)

Outputs:
  - JSON file with ingestion results
  - Console log of all operations
"""

import requests
import json
from datetime import datetime, timezone
from typing import List, Dict, Any

# API Endpoints (verified operational 2026-01-12)
WRITE_ENDPOINT = "https://javariai.com/api/javari/supabase/write"
READ_ENDPOINT = "https://javariai.com/api/javari/supabase/read"

# Roadmap Source Identifier
SOURCE = "master-blueprint-v1.2"
OWNER = "Roy"

def log(message: str):
    """Timestamped logging"""
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[{timestamp}] {message}")

def write_project(data: Dict[str, Any]) -> Dict[str, Any]:
    """Insert project via Supabase write proxy"""
    payload = {
        "table": "projects",
        "operation": "insert",
        "data": data
    }
    
    response = requests.post(WRITE_ENDPOINT, json=payload)
    response.raise_for_status()
    return response.json()

def read_projects(filters: List[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Read projects via Supabase read proxy"""
    payload = {
        "table": "projects",
        "filters": filters or [],
        "orderBy": [
            {"column": "created_at", "direction": "desc"}
        ]
    }
    
    response = requests.post(READ_ENDPOINT, json=payload)
    response.raise_for_status()
    return response.json()

def ingest_roadmap(dry_run: bool = False):
    """Ingest Master Blueprint roadmap into Supabase"""
    
    log("=" * 70)
    log("JAVARI ROADMAP INGESTION v1.2")
    log("=" * 70)
    
    if dry_run:
        log("🔍 DRY RUN MODE - No data will be written")
    
    # Define roadmap structure from Master Blueprint v1.2
    roadmap = [
        # PHASE 0.5 - Control Plane Items
        {
            "name": "Telemetry Engine v1.0",
            "description": "EventEmitter-based telemetry with heartbeat and failover detection",
            "status": "complete",
            "metadata": {
                "priority": 1,
                "owner": OWNER,
                "phase": "PHASE_0.5",
                "source": SOURCE,
                "pr_number": 426,
                "completion_date": "2026-01-12"
            }
        },
        {
            "name": "System Canon v1.0",
            "description": "Permanent reference document defining identity, modes, and capabilities",
            "status": "complete",
            "metadata": {
                "priority": 1,
                "owner": OWNER,
                "phase": "PHASE_0.5",
                "source": SOURCE,
                "pr_number": 417,
                "completion_date": "2026-01-12"
            }
        },
        {
            "name": "Supabase Write Proxy",
            "description": "Secure API route for controlled database writes (projects, milestones)",
            "status": "complete",
            "metadata": {
                "priority": 1,
                "owner": OWNER,
                "phase": "PHASE_0.5",
                "source": SOURCE,
                "endpoint": "/api/javari/supabase/write",
                "completion_date": "2026-01-12"
            }
        },
        {
            "name": "Supabase Read Proxy",
            "description": "Secure API route for querying database with filters, sorting, pagination",
            "status": "complete",
            "metadata": {
                "priority": 1,
                "owner": OWNER,
                "phase": "PHASE_0.5",
                "source": SOURCE,
                "endpoint": "/api/javari/supabase/read",
                "completion_date": "2026-01-12"
            }
        },
        
        # PHASE 1 - Document System
        {
            "name": "Central Document Repository",
            "description": "Unified storage for all system documentation with versioning",
            "status": "planned",
            "metadata": {
                "priority": 2,
                "owner": OWNER,
                "phase": "PHASE_1",
                "source": SOURCE,
                "blockers": ["Define storage schema", "Choose storage backend"]
            }
        },
        {
            "name": "Auto-versioning System",
            "description": "Automatic document version tracking and history",
            "status": "planned",
            "metadata": {
                "priority": 2,
                "owner": OWNER,
                "phase": "PHASE_1",
                "source": SOURCE,
                "dependencies": ["Central Document Repository"]
            }
        },
        {
            "name": "Document Ingestion Pipeline",
            "description": "Safe pipeline for importing external documents",
            "status": "planned",
            "metadata": {
                "priority": 2,
                "owner": OWNER,
                "phase": "PHASE_1",
                "source": SOURCE,
                "dependencies": ["Central Document Repository"]
            }
        },
        
        # PHASE 2 - Shared Services
        {
            "name": "Unified RBAC System",
            "description": "Role-based access control across all applications",
            "status": "planned",
            "metadata": {
                "priority": 3,
                "owner": OWNER,
                "phase": "PHASE_2",
                "source": SOURCE,
                "blockers": ["Define role taxonomy", "Choose auth provider"]
            }
        },
        {
            "name": "System-wide Audit Logging",
            "description": "Centralized audit trail for all system operations",
            "status": "planned",
            "metadata": {
                "priority": 3,
                "owner": OWNER,
                "phase": "PHASE_2",
                "source": SOURCE,
                "dependencies": ["Telemetry Engine v1.0"]
            }
        },
        {
            "name": "Telemetry Dashboard",
            "description": "Real-time monitoring and visualization of system health",
            "status": "planned",
            "metadata": {
                "priority": 3,
                "owner": OWNER,
                "phase": "PHASE_2",
                "source": SOURCE,
                "dependencies": ["Telemetry Engine v1.0"]
            }
        },
        
        # Add more phases as needed
    ]
    
    log(f"📋 Prepared {len(roadmap)} roadmap items for ingestion")
    
    if dry_run:
        log("\n🔍 DRY RUN - Would ingest:")
        for item in roadmap:
            status_emoji = "✅" if item["status"] == "complete" else "📋"
            log(f"  {status_emoji} [{item['metadata']['phase']}] {item['name']}")
        return
    
    # Real ingestion
    results = {
        "success": [],
        "failed": [],
        "skipped": [],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    for item in roadmap:
        try:
            log(f"📝 Ingesting: {item['name']} ({item['metadata']['phase']})")
            
            # Check if already exists
            existing = read_projects([
                {
                    "column": "name",
                    "operator": "eq",
                    "value": item["name"]
                }
            ])
            
            if existing.get("data") and len(existing["data"]) > 0:
                log(f"  ⏭️  Already exists, skipping...")
                results["skipped"].append(item["name"])
                continue
            
            # Insert new project
            response = write_project(item)
            
            if response.get("success"):
                record_id = response["recordIds"][0] if response.get("recordIds") else "unknown"
                log(f"  ✅ Inserted: {record_id}")
                results["success"].append({
                    "name": item["name"],
                    "id": record_id
                })
            else:
                log(f"  ❌ Failed: {response.get('error', 'Unknown error')}")
                results["failed"].append({
                    "name": item["name"],
                    "error": response.get("error")
                })
                
        except Exception as e:
            log(f"  ❌ Exception: {str(e)}")
            results["failed"].append({
                "name": item["name"],
                "error": str(e)
            })
    
    # Summary
    log("\n" + "=" * 70)
    log("INGESTION SUMMARY")
    log("=" * 70)
    log(f"✅ Success: {len(results['success'])}")
    log(f"⏭️  Skipped: {len(results['skipped'])}")
    log(f"❌ Failed:  {len(results['failed'])}")
    
    # Save results
    output_file = f"ingestion_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    log(f"\n📄 Results saved to: {output_file}")
    
    return results

if __name__ == "__main__":
    import sys
    
    dry_run = "--dry-run" in sys.argv
    
    try:
        results = ingest_roadmap(dry_run=dry_run)
        
        if not dry_run and results:
            # Exit with error if any failed
            if results["failed"]:
                sys.exit(1)
    except Exception as e:
        log(f"❌ FATAL ERROR: {str(e)}")
        sys.exit(1)
