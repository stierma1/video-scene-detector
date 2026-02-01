#!/bin/bash

# Video Scene Detector - Installation Script
# Supports macOS, Ubuntu/Debian, and other Linux distributions

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect operating system
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/debian_version ]; then
            OS="debian"
        elif [ -f /etc/redhat-release ]; then
            OS="redhat"
        else
            OS="linux"
        fi
    else
        OS="unknown"
    fi
    log_info "Detected OS: $OS"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js version
check_node_version() {
    local required_version="18.0.0"
    local current_version
    
    if ! command_exists node; then
        return 1
    fi
    
    current_version=$(node --version | sed 's/v//')
    
    # Compare versions
    if [ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" = "$required_version" ]; then
        return 0
    else
        return 1
    fi
}

# Install FFmpeg on macOS
install_ffmpeg_macos() {
    log_info "Installing FFmpeg on macOS..."
    
    if ! command_exists brew; then
        log_info "Homebrew not found. Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    fi
    
    brew install ffmpeg
}

# Install FFmpeg on Debian/Ubuntu
install_ffmpeg_debian() {
    log_info "Installing FFmpeg on Debian/Ubuntu..."
    
    sudo apt-get update
    sudo apt-get install -y ffmpeg
}

# Install FFmpeg on RedHat/CentOS/Fedora
install_ffmpeg_redhat() {
    log_info "Installing FFmpeg on RedHat-based system..."
    
    if command_exists dnf; then
        sudo dnf install -y ffmpeg ffmpeg-devel
    elif command_exists yum; then
        sudo yum install -y ffmpeg ffmpeg-devel
    else
        log_error "Package manager not found. Please install FFmpeg manually."
        exit 1
    fi
}

# Install FFmpeg
install_ffmpeg() {
    if command_exists ffmpeg; then
        log_success "FFmpeg is already installed: $(ffmpeg -version | head -n1)"
        return 0
    fi
    
    log_warning "FFmpeg not found. Installing..."
    
    case $OS in
        macos)
            install_ffmpeg_macos
            ;;
        debian)
            install_ffmpeg_debian
            ;;
        redhat)
            install_ffmpeg_redhat
            ;;
        *)
            log_error "Unsupported OS for automatic FFmpeg installation."
            log_info "Please install FFmpeg manually from: https://ffmpeg.org/download.html"
            exit 1
            ;;
    esac
    
    if command_exists ffmpeg; then
        log_success "FFmpeg installed successfully: $(ffmpeg -version | head -n1)"
    else
        log_error "FFmpeg installation failed."
        exit 1
    fi
}

# Check Python
install_python_deps() {
    log_info "Checking Python installation..."
    
    local python_cmd=""
    
    if command_exists python3; then
        python_cmd="python3"
    elif command_exists python; then
        python_cmd="python"
    else
        log_error "Python is not installed. Please install Python 3.x manually."
        exit 1
    fi
    
    local python_version=$($python_cmd --version 2>&1 | awk '{print $2}')
    log_success "Python found: $python_version"
    
    # Install pyscenedetect
    log_info "Installing pyscenedetect..."
    
    # Check if pip is available
    local pip_cmd=""
    if command_exists pip3; then
        pip_cmd="pip3"
    elif command_exists pip; then
        pip_cmd="pip"
    else
        log_warning "pip not found. Attempting to install..."
        $python_cmd -m ensurepip --upgrade 2>/dev/null || true
        pip_cmd="$python_cmd -m pip"
    fi
    
    $pip_cmd install --user scenedetect || $pip_cmd install scenedetect
    
    if $python_cmd -c "import scenedetect" 2>/dev/null; then
        log_success "pyscenedetect installed successfully"
    else
        log_warning "pyscenedetect installation may have failed. You may need to install it manually:"
        log_info "  $pip_cmd install scenedetect"
    fi
}

# Install Node.js dependencies
install_node_deps() {
    log_info "Installing Node.js dependencies..."
    
    if ! command_exists npm; then
        log_error "npm is not found. Please ensure Node.js is properly installed."
        exit 1
    fi
    
    npm install
    
    log_success "Node.js dependencies installed successfully"
}

# Create required directories
create_directories() {
    log_info "Creating required directories..."
    
    mkdir -p uploads outputs
    
    log_success "Directories created: uploads/, outputs/"
}

# Print summary
print_summary() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Dependencies installed:"
    echo "  ✓ FFmpeg: $(ffmpeg -version | head -n1 | cut -d' ' -f3)"
    echo "  ✓ Python: $(python3 --version 2>/dev/null || python --version 2>/dev/null)"
    echo "  ✓ Node.js: $(node --version)"
    echo "  ✓ npm packages: installed"
    echo ""
    echo "To start the application:"
    echo "  Development mode: npm run dev"
    echo "  Production mode:  npm start"
    echo ""
    echo "The server will start on http://localhost:5000"
    echo ""
}

# Main installation flow
main() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  Video Scene Detector Installer${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    detect_os
    
    # Check Node.js
    log_info "Checking Node.js..."
    if check_node_version; then
        log_success "Node.js $(node --version) is installed and meets requirements (>= 18.0.0)"
    else
        log_error "Node.js >= 18.0.0 is required but not found."
        log_info "Please install Node.js from: https://nodejs.org/"
        exit 1
    fi
    
    # Install dependencies
    install_ffmpeg
    install_python_deps
    install_node_deps
    create_directories
    
    # Print summary
    print_summary
}

# Run main function
main "$@"
