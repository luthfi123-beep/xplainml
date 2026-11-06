from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import dataset, preprocess, train, explain, export

app = FastAPI(
    title="XplainML API",
    description="Interactive ML Explainability Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dataset.router, prefix="/api/dataset", tags=["Dataset"])
app.include_router(preprocess.router, prefix="/api/preprocess", tags=["Preprocessing"])
app.include_router(train.router, prefix="/api/train", tags=["Training"])
app.include_router(explain.router, prefix="/api/explain", tags=["Explainability"])
app.include_router(export.router, prefix="/api/export", tags=["Export"])

@app.get("/")
def root():
    return {"status": "XplainML API is running"}