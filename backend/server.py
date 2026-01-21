from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
from bson import ObjectId


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Helper function to convert ObjectId to string
def serialize_doc(doc):
    if doc is None:
        return None
    doc['id'] = str(doc['_id'])
    del doc['_id']
    return doc


# Define Models
class SubjectCreate(BaseModel):
    name: str

class SubjectResponse(BaseModel):
    id: str
    name: str
    created_at: datetime

class SubjectUpdate(BaseModel):
    name: str

class TopicCreate(BaseModel):
    subject_id: str
    name: str
    notes: Optional[str] = ""

class TopicUpdate(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None

class RevisionDate(BaseModel):
    date: datetime
    day_number: int  # 2, 7, or 14
    completed: bool = False

class TopicResponse(BaseModel):
    id: str
    subject_id: str
    subject_name: str
    name: str
    notes: str
    created_at: datetime
    revision_dates: List[dict]

class CompleteRevisionRequest(BaseModel):
    topic_id: str
    day_number: int


# Subject Endpoints
@api_router.get("/")
async def root():
    return {"message": "Spaced Repetition API"}


@api_router.post("/subjects", response_model=SubjectResponse)
async def create_subject(subject: SubjectCreate):
    subject_dict = {
        "name": subject.name,
        "created_at": datetime.utcnow()
    }
    result = await db.subjects.insert_one(subject_dict)
    subject_dict['_id'] = result.inserted_id
    return serialize_doc(subject_dict)


@api_router.get("/subjects", response_model=List[SubjectResponse])
async def get_subjects():
    subjects = await db.subjects.find().sort("created_at", -1).to_list(1000)
    return [serialize_doc(s) for s in subjects]


@api_router.get("/subjects/{subject_id}", response_model=SubjectResponse)
async def get_subject(subject_id: str):
    try:
        subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        return serialize_doc(subject)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.put("/subjects/{subject_id}", response_model=SubjectResponse)
async def update_subject(subject_id: str, subject: SubjectUpdate):
    try:
        result = await db.subjects.find_one_and_update(
            {"_id": ObjectId(subject_id)},
            {"$set": {"name": subject.name}},
            return_document=True
        )
        if not result:
            raise HTTPException(status_code=404, detail="Subject not found")
        return serialize_doc(result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/subjects/{subject_id}")
async def delete_subject(subject_id: str):
    try:
        # Delete all topics under this subject
        await db.topics.delete_many({"subject_id": subject_id})
        # Delete the subject
        result = await db.subjects.delete_one({"_id": ObjectId(subject_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Subject not found")
        return {"message": "Subject deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# Topic Endpoints
@api_router.post("/topics", response_model=TopicResponse)
async def create_topic(topic: TopicCreate):
    try:
        # Verify subject exists
        subject = await db.subjects.find_one({"_id": ObjectId(topic.subject_id)})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        created_at = datetime.utcnow()
        
        # Calculate revision dates: Day 2, Day 7, Day 14
        revision_dates = [
            {"date": (created_at + timedelta(days=2)).isoformat(), "day_number": 2, "completed": False},
            {"date": (created_at + timedelta(days=7)).isoformat(), "day_number": 7, "completed": False},
            {"date": (created_at + timedelta(days=14)).isoformat(), "day_number": 14, "completed": False}
        ]
        
        topic_dict = {
            "subject_id": topic.subject_id,
            "name": topic.name,
            "notes": topic.notes or "",
            "created_at": created_at,
            "revision_dates": revision_dates
        }
        
        result = await db.topics.insert_one(topic_dict)
        topic_dict['_id'] = result.inserted_id
        topic_dict['subject_name'] = subject['name']
        
        return serialize_doc(topic_dict)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/topics", response_model=List[TopicResponse])
async def get_all_topics():
    topics = await db.topics.find().sort("created_at", -1).to_list(1000)
    
    # Batch fetch all subjects to avoid N+1 queries
    subjects = await db.subjects.find().to_list(None)
    subjects_dict = {str(s['_id']): s['name'] for s in subjects}
    
    result = []
    for t in topics:
        t['subject_name'] = subjects_dict.get(t['subject_id'], 'Unknown')
        result.append(serialize_doc(t))
    return result


@api_router.get("/subjects/{subject_id}/topics", response_model=List[TopicResponse])
async def get_topics_by_subject(subject_id: str):
    try:
        subject = await db.subjects.find_one({"_id": ObjectId(subject_id)})
        if not subject:
            raise HTTPException(status_code=404, detail="Subject not found")
        
        topics = await db.topics.find({"subject_id": subject_id}).sort("created_at", -1).to_list(1000)
        result = []
        for t in topics:
            t['subject_name'] = subject['name']
            result.append(serialize_doc(t))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/topics/{topic_id}", response_model=TopicResponse)
async def get_topic(topic_id: str):
    try:
        topic = await db.topics.find_one({"_id": ObjectId(topic_id)})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        subject = await db.subjects.find_one({"_id": ObjectId(topic['subject_id'])})
        topic['subject_name'] = subject['name'] if subject else 'Unknown'
        return serialize_doc(topic)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(topic_id: str, topic_update: TopicUpdate):
    try:
        update_dict = {}
        if topic_update.name is not None:
            update_dict['name'] = topic_update.name
        if topic_update.notes is not None:
            update_dict['notes'] = topic_update.notes
        
        if not update_dict:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        result = await db.topics.find_one_and_update(
            {"_id": ObjectId(topic_id)},
            {"$set": update_dict},
            return_document=True
        )
        
        if not result:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        subject = await db.subjects.find_one({"_id": ObjectId(result['subject_id'])})
        result['subject_name'] = subject['name'] if subject else 'Unknown'
        return serialize_doc(result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.delete("/topics/{topic_id}")
async def delete_topic(topic_id: str):
    try:
        result = await db.topics.delete_one({"_id": ObjectId(topic_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Topic not found")
        return {"message": "Topic deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.post("/topics/complete-revision")
async def complete_revision(request: CompleteRevisionRequest):
    try:
        topic = await db.topics.find_one({"_id": ObjectId(request.topic_id)})
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
        
        # Update the specific revision date's completed status
        revision_dates = topic['revision_dates']
        for rd in revision_dates:
            if rd['day_number'] == request.day_number:
                rd['completed'] = True
                break
        
        await db.topics.update_one(
            {"_id": ObjectId(request.topic_id)},
            {"$set": {"revision_dates": revision_dates}}
        )
        
        return {"message": "Revision marked as completed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@api_router.get("/revisions/today")
async def get_today_revisions():
    """Get all topics that need revision today"""
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    # Batch fetch all subjects to avoid N+1 queries
    subjects = await db.subjects.find().to_list(None)
    subjects_dict = {str(s['_id']): s['name'] for s in subjects}
    
    topics = await db.topics.find().to_list(1000)
    today_revisions = []
    
    for topic in topics:
        subject_name = subjects_dict.get(topic['subject_id'], 'Unknown')
        
        for rd in topic['revision_dates']:
            revision_date = datetime.fromisoformat(rd['date'].replace('Z', '+00:00')) if isinstance(rd['date'], str) else rd['date']
            if today_start <= revision_date <= today_end and not rd['completed']:
                today_revisions.append({
                    "id": str(topic['_id']),
                    "topic_name": topic['name'],
                    "subject_name": subject_name,
                    "subject_id": topic['subject_id'],
                    "notes": topic['notes'],
                    "day_number": rd['day_number'],
                    "revision_date": rd['date']
                })
    
    return today_revisions


@api_router.get("/revisions/upcoming")
async def get_upcoming_revisions():
    """Get upcoming revisions (grouped by topic, showing next revision date)"""
    today = datetime.utcnow()
    
    # Batch fetch all subjects to avoid N+1 queries
    subjects = await db.subjects.find().to_list(None)
    subjects_dict = {str(s['_id']): s['name'] for s in subjects}
    
    topics = await db.topics.find().to_list(1000)
    upcoming = []
    
    for topic in topics:
        subject_name = subjects_dict.get(topic['subject_id'], 'Unknown')
        
        # Find the next incomplete revision date for this topic
        next_revision = None
        for rd in topic['revision_dates']:
            if not rd['completed']:
                revision_date = datetime.fromisoformat(rd['date'].replace('Z', '+00:00')) if isinstance(rd['date'], str) else rd['date']
                # Only include future revisions (not today's)
                if revision_date.date() > today.date():
                    if next_revision is None or revision_date < datetime.fromisoformat(next_revision['date'].replace('Z', '+00:00')):
                        next_revision = rd
        
        if next_revision:
            upcoming.append({
                "id": str(topic['_id']),
                "topic_name": topic['name'],
                "subject_name": subject_name,
                "subject_id": topic['subject_id'],
                "notes": topic['notes'],
                "day_number": next_revision['day_number'],
                "revision_date": next_revision['date'],
                "created_at": topic['created_at'].isoformat()
            })
    
    # Sort by revision date
    upcoming.sort(key=lambda x: x['revision_date'])
    return upcoming


# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
