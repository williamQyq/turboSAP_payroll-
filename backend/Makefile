# ===============================
# Makefile inside backend/
# ===============================

FRONTEND_DIR := ..
FRONTEND_DIR_AGENT := app-agent/packages/app

BACKEND_DIR := .
BACKEND_DIR_AGENT := app-agent/packages/code-agent

DEPLOY_DIR := deploy
STATIC_DIR := app/static
ZIP_NAME := backend-$(shell date +%Y%m%d%H%M%S).zip

VITE_API_URL := http://turbosap-py312-env.eba-5hg7r3id.us-east-2.elasticbeanstalk.com
VITE_APP_ENV := production
# ===============================
# default_code. Build the frontend
# ===============================
build-frontend:
	@echo "==> Building frontend with VITE_API_URL=$(VITE_API_URL)"
	cd $(FRONTEND_DIR) && VITE_API_URL=$(VITE_API_URL) VITE_APP_ENV=$(VITE_APP_ENV) npm run build

build-agent-frontend:
	cd $(FRONTEND_DIR_AGENT) && \
	VITE_OPENCODE_SERVER_PREFIX=agent-api \
	npm run build

build-agent-backend:
	cd $(BACKEND_DIR_AGENT) && npm run build

# ===============================
# 2. Copy static → backend/app/static
# ===============================
copy-static:
	@echo "==> Copying dist → $(STATIC_DIR)"
	rm -rf $(STATIC_DIR)
	mkdir -p $(STATIC_DIR)
	cp -a $(FRONTEND_DIR)/dist/. $(STATIC_DIR)/

# ===============================
# 3. Zip backend directory
# ===============================
package-backend:
	@echo "==> Zipping backend → $(DEPLOY_DIR)/$(ZIP_NAME)"
	mkdir -p $(DEPLOY_DIR)
	uv pip compile pyproject.toml -o requirements.txt

	zip -r "$(DEPLOY_DIR)/$(ZIP_NAME)" . \
		-x "deploy/*" \
		-x "*.zip" \
		-x "__pycache__/*" \
		-x "*.pyc" \
		-x "*/node_modules/*" \
		-x "node_modules/*" \
		-x "bun.lockb" \
		-x "packages/*/node_modules" \
		-x "dist/*" \
		-x "*/dist/*" \
		-x "*/*/dist/*"

# ===============================
# 4. Full pipeline
# ===============================
deploy: build-frontend build-agent-frontend copy-static package-backend
	@echo "==> Deployment package created: $(DEPLOY_DIR)/$(ZIP_NAME)"
