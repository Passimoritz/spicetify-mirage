cask "mirage-overlay" do
  version "1.15.0"
  sha256 "7b96c6b8b14014f08020d8d6b7a193476b40e914ec02c987490affd23642646b"

  url "https://github.com/Passimoritz/spicetify-mirage/releases/download/v#{version}/Mirage-Overlay.dmg"
  name "Mirage Overlay"
  desc "Song announcements, party edge light and room lights for the Mirage Spicetify theme"
  homepage "https://github.com/Passimoritz/spicetify-mirage"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Mirage Overlay.app"

  zap trash: [
    "~/Library/Application Support/Mirage Overlay",
    "~/Library/LaunchAgents/com.mirage.overlay.plist",
  ]

  caveats <<~EOS
    Mirage Overlay is not notarized yet. On first start, right-click the app in Applications and choose Open.
  EOS
end
