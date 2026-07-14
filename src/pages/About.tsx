import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import styles from './About.module.css';

interface AboutData {
  name: string;
  roles: string[];
  bio: string;
  about: string[];
}

interface EducationData {
  education: Array<{
    degree: string;
    year: string;
    institution: string;
    description: string;
  }>;
  certifications: string[];
  achievements: string[];
}

interface ExperienceData {
  experience: Array<{
    role: string;
    company: string;
    description: string;
  }>;
}

const About: React.FC = () => {
  const [aboutData, setAboutData] = useState<AboutData | null>(null);
  const [eduData, setEduData] = useState<EducationData | null>(null);
  const [expData, setExpData] = useState<ExperienceData | null>(null);

  useEffect(() => {
    import('../content/about.json').then(m => setAboutData(m.default));
    import('../content/education.json').then(m => setEduData(m.default));
    import('../content/experience.json').then(m => setExpData(m.default));
  }, []);

  if (!aboutData || !eduData || !expData) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className={styles.container}
    >
      <header className={styles.header}>
        <h1 className={styles.title}>About Me</h1>
        <h2 className={styles.bio}>{aboutData.bio}</h2>
      </header>

      <section className={styles.section}>
        <div className={styles.grid}>
          <div className={styles.column}>
            <h3>My Story</h3>
            {aboutData.about.map((p, i) => <p key={i}>{p}</p>)}
          </div>
          
          <div className={styles.column}>
            <h3>Experience</h3>
            <div className={styles.timeline}>
              {expData.experience.map((exp, i) => (
                <div key={i} className={styles.timelineItem}>
                  <h4>{exp.role}</h4>
                  <span className={styles.company}>{exp.company}</span>
                  <p>{exp.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.grid}>
          <div className={styles.column}>
            <h3>Education</h3>
            <div className={styles.timeline}>
              {eduData.education.map((edu, i) => (
                <div key={i} className={styles.timelineItem}>
                  <h4>{edu.degree}</h4>
                  <span className={styles.company}>{edu.institution} {edu.year && `(${edu.year})`}</span>
                  {edu.description && <p>{edu.description}</p>}
                </div>
              ))}
            </div>
          </div>
          
          <div className={styles.column}>
            <h3>Certifications & Achievements</h3>
            <ul className={styles.list}>
              {eduData.certifications.map((cert, i) => <li key={i}>{cert}</li>)}
            </ul>
            <br />
            <ul className={styles.list}>
              {eduData.achievements.map((ach, i) => <li key={i}>{ach}</li>)}
            </ul>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default About;
