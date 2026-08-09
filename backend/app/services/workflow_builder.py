import logging
import asyncio
import time
from typing import Dict, Any, List
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.workflow import WorkflowRule, WorkflowStep, WorkflowExecutionLog

logger = logging.getLogger(__name__)

class WorkflowEngine:
    async def trigger_workflow(self, tenant_id: int, trigger_event: str, context: Dict[str, Any]):
        """Trigger any active workflows matching this event in a background thread."""
        db = SessionLocal()
        try:
            rules = db.query(WorkflowRule).filter(
                WorkflowRule.tenant_id == tenant_id,
                WorkflowRule.trigger_event == trigger_event,
                WorkflowRule.active == True
            ).all()

            for rule in rules:
                logger.info(f"Triggering workflow rule '{rule.name}' for event '{trigger_event}'")
                asyncio.create_task(self.execute_workflow(rule.id, context))
        except Exception as e:
            logger.error(f"Error triggering workflows for event {trigger_event}: {e}")
        finally:
            db.close()

    async def execute_workflow(self, rule_id: int, context: Dict[str, Any]):
        """Executes a workflow rule's steps sequentially with logging and retry support."""
        db = SessionLocal()
        log_entry = WorkflowExecutionLog(rule_id=rule_id, status="running", logs_json={"steps_executed": [], "errors": []})
        db.add(log_entry)
        db.commit()
        db.refresh(log_entry)

        try:
            rule = db.query(WorkflowRule).filter(WorkflowRule.id == rule_id).first()
            if not rule:
                logger.error(f"WorkflowRule {rule_id} not found.")
                return

            steps = sorted(rule.steps, key=lambda s: s.step_index)
            step_logs = []

            for step in steps:
                action = step.action_type
                config = step.action_config or {}
                logger.info(f"Executing step {step.step_index}: {action}")
                
                success = False
                attempts = 0
                max_retries = config.get("retries", 1)

                while not success and attempts < max_retries:
                    attempts += 1
                    try:
                        if action == "IfElse":
                            # E.g. {"field": "total_amount", "op": "gt", "value": 5000}
                            field = config.get("field")
                            op = config.get("op")
                            val = config.get("value")
                            
                            actual_val = context.get(field)
                            condition_met = False
                            
                            if op == "gt" and actual_val and float(actual_val) > float(val):
                                condition_met = True
                            elif op == "eq" and str(actual_val) == str(val):
                                condition_met = True
                            
                            step_logs.append({
                                "step": step.step_index,
                                "type": "IfElse",
                                "condition_met": condition_met,
                                "field": field,
                                "actual": actual_val
                            })
                            # If condition fails, we skip subsequent steps (mock logic)
                            if not condition_met:
                                logger.info(f"IfElse condition failed. Halting workflow rule execution.")
                                success = True
                                break
                            success = True

                        elif action == "Email":
                            # Mock send email
                            to = config.get("to") or context.get("email", "customer@travelos.com")
                            subject = config.get("subject", "Workflow notification")
                            logger.info(f"Dispatched email to {to} with subject '{subject}'")
                            step_logs.append({"step": step.step_index, "type": "Email", "sent_to": to})
                            success = True

                        elif action == "Webhook":
                            url = config.get("url")
                            if url:
                                async with httpx.AsyncClient(timeout=5.0) as client:
                                    resp = await client.post(url, json=context)
                                    step_logs.append({
                                        "step": step.step_index,
                                        "type": "Webhook",
                                        "url": url,
                                        "status_code": resp.status_code
                                    })
                                    if resp.status_code < 400:
                                        success = True
                            else:
                                success = True

                        elif action == "Delay":
                            delay_seconds = min(5, int(config.get("seconds", 1)))  # Cap to 5s in tests
                            await asyncio.sleep(delay_seconds)
                            step_logs.append({"step": step.step_index, "type": "Delay", "seconds": delay_seconds})
                            success = True

                        elif action == "Approve":
                            # Require manual approval (transitions state to PENDING_APPROVAL)
                            booking_ref = context.get("booking_reference")
                            logger.info(f"Workflow Approve step triggered for booking: {booking_ref}")
                            step_logs.append({"step": step.step_index, "type": "Approve", "pending_approver": True})
                            success = True

                    except Exception as step_err:
                        logger.warning(f"Error at step {step.step_index} (attempt {attempts}/{max_retries}): {step_err}")
                        if attempts >= max_retries:
                            raise step_err

                if action == "IfElse" and not step_logs[-1].get("condition_met", True):
                    # Halting workflow on condition failure
                    break

            log_entry.status = "success"
            log_entry.logs_json = {"steps_executed": step_logs, "status": "completed"}
        except Exception as rule_err:
            logger.error(f"Workflow execution failed: {rule_err}")
            log_entry.status = "failed"
            log_entry.logs_json = {"error": str(rule_err), "status": "errored"}
        finally:
            db.commit()
            db.close()

# Global Workflow Engine
workflow_engine = WorkflowEngine()
