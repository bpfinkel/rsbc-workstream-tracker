import '../styles/globals.css';
import '../styles/publicMeetings.css';
import '../styles/meetingLocation.css';
import '../styles/rfpScoring.css';
import '../styles/desktopNav.css';
import '../styles/home.css';
import '../styles/keyDocuments.css';
import Footer from '../components/Footer';

export default function App({ Component, pageProps }) {
  return (
    <>
      <Component {...pageProps} />
      <Footer />
    </>
  );
}
