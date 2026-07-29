import os

# jwt_secret_key is now a required setting with no default, so importing `config`
# raises unless it is provided. Set safe test values here (os.environ takes
# precedence over any .env file) so the suite loads hermetically, including in CI
# where no .env exists. setdefault leaves a real environment untouched.
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production")
os.environ.setdefault("ENVIRONMENT", "development")
# Direct assignment (not setdefault): force this empty even if backend/.env has
# a real key, so no test can ever make a live Gemini API call, even one that
# forgets to monkeypatch it.
os.environ["GEMINI_API_KEY"] = ""
